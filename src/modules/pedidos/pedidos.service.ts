import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PedidosRepository } from './repositories/pedidos.repository';
import { CreatePedidoAdminDto } from './dto/create-pedido-admin.dto';
import { FilterPedidosDto } from './dto/filter-pedidos.dto';
import { Pedido } from './entities/pedido.entity';
import { PedidoEstado } from './enums/estado-pedido.enum';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class PedidosService {
  private readonly logger = new Logger(PedidosService.name);

  constructor(
    private readonly pedidosRepository: PedidosRepository,
    private readonly notificationsService: NotificationsService,
  ) {}

  async findAll(filters: FilterPedidosDto): Promise<Pedido[]> {
    return this.pedidosRepository.findWithFilters(filters);
  }

  async findOne(id: string): Promise<Pedido> {
    const pedido = await this.pedidosRepository.findByIdWithRelations(id);

    if (!pedido) {
      throw new NotFoundException(`Pedido con ID ${id} no encontrado`);
    }

    return pedido;
  }

  async findMyPedidos(usuarioId: string): Promise<Pedido[]> {
    return this.pedidosRepository.findByUsuario(usuarioId);
  }

  async getPedidosDelDia() {
    return this.pedidosRepository
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.usuario', 'u')
      .leftJoinAndSelect('p.comercio', 'c')
      .where(
        `
      p.created_at >= (((now() AT TIME ZONE 'America/Bogota')::date) AT TIME ZONE 'America/Bogota')
      AND
      p.created_at <  ((((now() AT TIME ZONE 'America/Bogota')::date) + INTERVAL '1 day') AT TIME ZONE 'America/Bogota')
    `,
      )
      .orderBy('p.created_at', 'DESC')
      .getMany();
  }

  async createPedidoByAdmin(dto: CreatePedidoAdminDto, adminId: string) {
    const pedido = this.pedidosRepository.create({
      usuarioId: dto.usuarioId,
      comercioId: dto.comercioId,
      valorFinal: dto.valorFinal,
      valorDomicilio: dto.valorDomicilio ?? 0,
      direccionDestino: dto.direccionDestino,
      direccionRecogida: dto.direccionRecogida,
      valorPedido: dto.valorPedido,
      clienteNombre: dto.clienteNombre,
      clienteTelefono: dto.clienteTelefono,
      domiciliarioId: dto.domiciliarioId,
      estado: PedidoEstado.EN_PROCESO,
      assignedBy: adminId,
      assignedAt: new Date(),
    });

    const pedidoGuardado = await this.pedidosRepository.save(pedido);

    void this.notificationsService
      .notifyUser(dto.usuarioId, {
        title: 'Nuevo domicilio asignado',
        body: 'Tienes un nuevo servicio en curso.',
        url: '/profile-delivery/current-delivery',
        pedidoId: pedidoGuardado.id,
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(
          `No se pudo enviar la notificación del pedido ${pedidoGuardado.id}: ${message}`,
        );
      });

    return pedidoGuardado;
  }

  async updateEstadoPedido(pedidoId: string, estado: PedidoEstado) {
    await this.pedidosRepository.update(pedidoId, { estado });
    return this.pedidosRepository.findOne({ where: { id: pedidoId } });
  }

  async getHistorialByDate(date: string) {
    const dateOnly = (date ?? '').slice(0, 10);

    return this.pedidosRepository
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.usuario', 'u')
      .leftJoinAndSelect('p.comercio', 'c')
      .where(
        `
      p.created_at >= ((:dateOnly::date) AT TIME ZONE 'America/Bogota')
      AND
      p.created_at <  (((:dateOnly::date) + INTERVAL '1 day') AT TIME ZONE 'America/Bogota')
      `,
        { dateOnly },
      )
      .orderBy('p.created_at', 'DESC')
      .getMany();
  }

  async getCurrentPedidoForDomiciliario(usuarioId: string) {
    const pedidos = await this.pedidosRepository.find({
      where: {
        usuario: { id: usuarioId },
        estado: PedidoEstado.EN_PROCESO,
      },
      relations: ['usuario', 'comercio'],
      order: { createdAt: 'DESC' },
      take: 1,
    });

    return pedidos[0] ?? null;
  }

  async remove(id: string): Promise<void> {
    const pedido = await this.findOne(id);
    await this.pedidosRepository.remove(pedido);
  }
}
