import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PedidosRepository } from './repositories/pedidos.repository';
import { CreatePedidoAdminDto } from './dto/create-pedido-admin.dto';
import { Pedido } from './entities/pedido.entity';
import { PedidoEstado } from './enums/estado-pedido.enum';
import { NotificationsService } from '../notifications/notifications.service';
import { UsuariosService } from '../usuarios/usuarios.service';
import { Rol } from '../usuarios/enums/rol.enum';
import { getColombiaDayRange } from '../../common/time/colombia-time';

@Injectable()
export class PedidosService {
  private readonly logger = new Logger(PedidosService.name);

  constructor(
    private readonly pedidosRepository: PedidosRepository,
    private readonly notificationsService: NotificationsService,
    private readonly usuariosService: UsuariosService,
  ) {}

  async getPedidosDelDia(usuarioId?: string) {
    const finalCutoff = this.hoursAgo(12);
    const query = this.pedidosRepository
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.usuario', 'u')
      .leftJoinAndSelect('p.comercio', 'c')
      .where(
        '(p.estado = :activeState OR (p.estado IN (:...finalStates) AND p.updated_at >= :finalCutoff))',
        {
          activeState: PedidoEstado.EN_PROCESO,
          finalStates: [PedidoEstado.HECHO, PedidoEstado.CANCELADO],
          finalCutoff,
        },
      );

    if (usuarioId) {
      query.andWhere('p.usuario_id = :usuarioId', { usuarioId });
    }

    return query.orderBy('p.updated_at', 'DESC').getMany();
  }

  async createPedidoByAdmin(dto: CreatePedidoAdminDto, adminId: string) {
    const domiciliarioId = dto.domiciliarioId ?? dto.usuarioId;
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
      domiciliarioId,
      direccionEntrega: dto.direccionEntrega,
      detallesAdicionales: dto.detallesAdicionales,
      estado: PedidoEstado.EN_PROCESO,
      assignedBy: adminId,
      assignedAt: new Date(),
    });

    const pedidoGuardado = await this.pedidosRepository.save(pedido);

    // Notificar al domiciliario si fue asignado
    if (domiciliarioId) {
      void (async () => {
        try {
          const domiciliario = await this.usuariosService.findOne(domiciliarioId);
          await this.notificationsService.notifyDomiciliarioAsignado({
            domiciliarioId: domiciliario.id,
            domiciliarioNombre: domiciliario.nombre,
            pedidoId: pedidoGuardado.id,
          });
        } catch (error: unknown) {
          const msg = error instanceof Error ? error.message : String(error);
          this.logger.error(
            `No se pudo notificar al domiciliario del pedido ${pedidoGuardado.id}: ${msg}`,
          );
        }
      })();
    }

    return pedidoGuardado;
  }

  /**
   * Actualiza el estado de un pedido.
   *
   * - Si el actor es DOMICILIARIO, valida que el pedido le pertenezca (domiciliarioId).
   * - Nunca modifica createdAt (bug corregido).
   * - Usa updatedAt automático (UpdateDateColumn).
   * - Notifica al admin (assignedBy) cuando un domiciliario cambia el estado.
   *
   * @param pedidoId  ID del pedido
   * @param estado    Nuevo estado
   * @param actor     Usuario que ejecuta la acción (rol + id)
   */
  async updateEstadoPedido(
    pedidoId: string,
    estado: PedidoEstado,
    actor: { id: string; rol: Rol },
  ): Promise<Pedido | null> {
    const pedido = await this.pedidosRepository.findOne({
      where: { id: pedidoId },
      relations: ['usuario'],
    });

    if (!pedido) {
      throw new NotFoundException(`Pedido con ID ${pedidoId} no encontrado`);
    }

    if (
      (pedido.estado === PedidoEstado.HECHO ||
        pedido.estado === PedidoEstado.CANCELADO) &&
      pedido.estado !== estado
    ) {
      throw new BadRequestException(
        'No se puede cambiar el estado de un pedido finalizado.',
      );
    }

    // Validación de propietario para domiciliarios
    if (actor.rol === Rol.DOMICILIARIO && pedido.domiciliarioId !== actor.id) {
      throw new ForbiddenException(
        'No tienes permiso para modificar este pedido.',
      );
    }

    // Actualizar solo el estado — updatedAt se maneja automáticamente
    await this.pedidosRepository.update(pedidoId, { estado });

    // Notificar al admin si el cambio lo hace un domiciliario
    if (actor.rol === Rol.DOMICILIARIO && pedido.assignedBy) {
      void (async () => {
        try {
          const domiciliario = await this.usuariosService.findOne(actor.id);
          await this.notificationsService.notifyAdminEstadoCambiado({
            adminId: pedido.assignedBy,
            domiciliarioNombre: domiciliario.nombre,
            pedidoId,
            estado,
          });
        } catch (error: unknown) {
          const msg = error instanceof Error ? error.message : String(error);
          this.logger.error(
            `No se pudo notificar al admin del cambio de estado del pedido ${pedidoId}: ${msg}`,
          );
        }
      })();
    }

    return this.pedidosRepository.findOne({ where: { id: pedidoId } });
  }

  async getHistorialByDate(date: string) {
    const { start, end } = this.getColombiaRange(date);
    const retentionCutoff = this.daysAgo(60);

    if (end <= retentionCutoff) {
      return [];
    }

    const effectiveStart = start > retentionCutoff ? start : retentionCutoff;

    return this.pedidosRepository
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.usuario', 'u')
      .leftJoinAndSelect('p.comercio', 'c')
      .where('p.created_at >= :start AND p.created_at < :end', { start: effectiveStart, end })
      .orderBy('p.created_at', 'DESC')
      .getMany();
  }

  async getAllHistory(search?: string) {
    const normalizedSearch = search?.trim();
    return this.pedidosRepository.findAllHistory(
      normalizedSearch || undefined,
      this.daysAgo(60),
    );
  }

  async getHistorialDomiciliarioByDate(date: string, usuarioId: string) {
    const { start, end } = this.getColombiaRange(date);

    return this.pedidosRepository
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.usuario', 'u')
      .leftJoinAndSelect('p.comercio', 'c')
      .where(
        'p.created_at >= :start AND p.created_at < :end AND p.usuario_id = :usuarioId',
        { start, end, usuarioId },
      )
      .orderBy('p.created_at', 'DESC')
      .getMany();
  }

  async getHistorialDomiciliarioUltimos60Dias(usuarioId: string) {
    return this.pedidosRepository
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.usuario', 'u')
      .leftJoinAndSelect('p.comercio', 'c')
      .where('p.created_at >= :retentionCutoff AND p.usuario_id = :usuarioId', {
        retentionCutoff: this.daysAgo(60), usuarioId,
      })
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

  private getColombiaRange(date: string) {
    try {
      return getColombiaDayRange(date);
    } catch {
      throw new BadRequestException('La fecha debe usar el formato YYYY-MM-DD.');
    }
  }

  private hoursAgo(hours: number) {
    return new Date(Date.now() - hours * 60 * 60 * 1000);
  }

  private daysAgo(days: number) {
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  }
}
