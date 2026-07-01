import {
  BadRequestException,
  ConflictException,
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
import { Usuario } from '../usuarios/entities/usuario.entity';
import { DisponibilidadDomiciliario } from '../usuarios/enums/disponibilidad-domiciliario.enum';
import { getColombiaDayRange } from '../../common/time/colombia-time';
import { MAX_ACTIVE_PEDIDOS_PER_DOMICILIARIO } from './pedidos.constants';

const COURIER_PRESENCE_TTL_MS = 2 * 60 * 1000;

@Injectable()
export class PedidosService {
  private readonly logger = new Logger(PedidosService.name);

  constructor(
    private readonly pedidosRepository: PedidosRepository,
    private readonly notificationsService: NotificationsService,
    private readonly usuariosService: UsuariosService,
  ) { }

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

  async getPedidosDisponiblesDomiciliario() {
    return this.pedidosRepository.findAvailablePedidos();
  }

  async createPedidoByAdmin(dto: CreatePedidoAdminDto, adminId: string) {
    const manualDomiciliarioId = await this.resolveManualDomiciliarioId(dto);
    const ganancia = dto.ganancia ?? dto.valorDomicilio ?? 0;

    const pedido = this.pedidosRepository.create({
      usuarioId: manualDomiciliarioId,
      comercioId: dto.comercioId,
      valorFinal: dto.valorFinal,
      valorDomicilio: ganancia,
      ganancia,
      direccionDestino: dto.direccionDestino,
      direccionRecogida: dto.direccionRecogida,
      valorPedido: dto.valorPedido,
      clienteNombre: dto.clienteNombre,
      clienteTelefono: dto.clienteTelefono,
      domiciliarioId: manualDomiciliarioId,
      direccionEntrega: dto.direccionEntrega,
      detallesAdicionales: dto.detallesAdicionales,
      estado: PedidoEstado.EN_PROCESO,
      assignedBy: adminId,
      assignedAt: manualDomiciliarioId ? new Date() : null,
    });

    const pedidoGuardado = await this.pedidosRepository.save(pedido);

    if (manualDomiciliarioId) {
      await this.notifyAssignedDomiciliario(manualDomiciliarioId, pedidoGuardado.id);
    } else {
      await this.notifyPedidoDisponible(pedidoGuardado.id);
    }

    return pedidoGuardado;
  }

  async tomarPedidoDisponible(pedidoId: string, domiciliarioId: string) {
    const currentPedidos =
      await this.getCurrentPedidosForDomiciliario(domiciliarioId);

    if (currentPedidos.length >= MAX_ACTIVE_PEDIDOS_PER_DOMICILIARIO) {
      throw new BadRequestException(
        `Ya tienes ${MAX_ACTIVE_PEDIDOS_PER_DOMICILIARIO} pedidos en curso. Finaliza uno antes de tomar otro.`,
      );
    }

    const pedido = await this.pedidosRepository.takeAvailablePedido(
      pedidoId,
      domiciliarioId,
    );

    if (!pedido) {
      throw new ConflictException('Este pedido ya fue asignado.');
    }

    await this.notifyAdminPedidoTomado(pedido, domiciliarioId);

    return pedido;
  }

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

    if (actor.rol === Rol.DOMICILIARIO && pedido.domiciliarioId !== actor.id) {
      throw new ForbiddenException(
        'No tienes permiso para modificar este pedido.',
      );
    }

    await this.pedidosRepository.update(pedidoId, { estado });

    if (actor.rol === Rol.DOMICILIARIO && pedido.assignedBy) {
      await this.notifyAdminEstado(
        pedido.assignedBy,
        actor.id,
        pedidoId,
        estado,
        Number(pedido.ganancia ?? pedido.valorDomicilio ?? 0),
      );
    }

    return this.pedidosRepository.findOne({ where: { id: pedidoId } });
  }

  async getHistorialByDate(date: string) {
    const { start, end } = this.getColombiaRange(date);
    const retentionCutoff = this.daysAgo(60);

    if (end <= retentionCutoff) {
      return [];
    }

    return this.pedidosRepository
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.usuario', 'u')
      .leftJoinAndSelect('p.comercio', 'c')
      .where('p.created_at >= :start AND p.created_at < :end', {
        start: start > retentionCutoff ? start : retentionCutoff,
        end,
      })
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
        retentionCutoff: this.daysAgo(60),
        usuarioId,
      })
      .orderBy('p.created_at', 'DESC')
      .getMany();
  }

  async getCurrentPedidoForDomiciliario(usuarioId: string) {
    const pedidos = await this.getCurrentPedidosForDomiciliario(usuarioId);

    return pedidos[0] ?? null;
  }

  async getCurrentPedidosForDomiciliario(usuarioId: string) {
    const pedidos = await this.pedidosRepository.find({
      where: {
        usuarioId,
        estado: PedidoEstado.EN_PROCESO,
      },
      relations: ['usuario', 'comercio'],
      order: { createdAt: 'DESC' },
      take: MAX_ACTIVE_PEDIDOS_PER_DOMICILIARIO,
    });

    return pedidos;
  }

  private async resolveManualDomiciliarioId(
    dto: CreatePedidoAdminDto,
  ): Promise<string | null> {
    const manualId = dto.domiciliarioId ?? dto.usuarioId;

    if (!manualId) {
      return null;
    }

    const availableManualCourier =
      await this.pedidosRepository.findAvailableCourierById(manualId);

    if (!availableManualCourier) {
      throw new BadRequestException(
        'Ese domiciliario no está disponible. Puede estar ocupado, bloqueado o sin confirmar.',
      );
    }

    return availableManualCourier.id;
  }

  private async getNotifiableDomiciliarios() {
    const connectedAfter = new Date(Date.now() - COURIER_PRESENCE_TTL_MS);

    return this.pedidosRepository.manager
      .createQueryBuilder()
      .select('usuario.id', 'id')
      .addSelect('usuario.nombre', 'nombre')
      .from(Usuario, 'usuario')
      .leftJoin(
        Pedido,
        'activePedido',
        'activePedido.usuario_id = usuario.id AND activePedido.estado = :activeState',
        { activeState: PedidoEstado.EN_PROCESO },
      )
      .where('usuario.rol = :rol', { rol: Rol.DOMICILIARIO })
      .andWhere('usuario.bloqueado = false')
      .andWhere('usuario.email_confirmado = true')
      .andWhere('usuario.disponibilidad = :disponibilidad', {
        disponibilidad: DisponibilidadDomiciliario.AVAILABLE,
      })
      .andWhere('usuario.last_seen_at >= :connectedAfter', { connectedAfter })
      .groupBy('usuario.id')
      .addGroupBy('usuario.nombre')
      .having('COUNT(DISTINCT activePedido.id) < :maxActivePedidos', {
        maxActivePedidos: MAX_ACTIVE_PEDIDOS_PER_DOMICILIARIO,
      })
      .orderBy('usuario.nombre', 'ASC')
      .getRawMany<{ id: string; nombre: string }>();
  }

  private async notifyPedidoDisponible(pedidoId: string) {
    try {
      const pedido = await this.pedidosRepository.findOne({
        where: { id: pedidoId },
        relations: ['comercio'],
      });

      if (!pedido) return;

      const domiciliarios = await this.getNotifiableDomiciliarios();
      const comercioNombre = pedido.comercio?.nombre ?? 'Comercio';
      const direccionRecogida = pedido.direccionRecogida ?? pedido.comercio?.direccion ?? comercioNombre;

      await this.notificationsService.notifyPedidoDisponible({
        domiciliarioIds: domiciliarios.map((d) => d.id),
        pedidoId,
        comercioNombre,
        direccionRecogida,
        direccionDestino: pedido.direccionDestino,
        ganancia: Number(pedido.ganancia ?? pedido.valorDomicilio ?? 0),
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`No se pudo notificar pedido disponible ${pedidoId}: ${msg}`);
    }
  }

  private async notifyAssignedDomiciliario(
    domiciliarioId: string,
    pedidoId: string,
  ) {
    try {
      const d = await this.usuariosService.findOne(domiciliarioId);
      const pedido = await this.pedidosRepository.findOne({
        where: { id: pedidoId },
        relations: ['comercio'],
      });
      const comercioNombre = pedido?.comercio?.nombre ?? 'Comercio';

      await this.notificationsService.notifyDomiciliarioAsignado({
        domiciliarioId: d.id,
        domiciliarioNombre: d.nombre,
        pedidoId,
        comercioNombre,
        direccionRecogida: pedido?.direccionRecogida ?? pedido?.comercio?.direccion ?? comercioNombre,
        direccionDestino: pedido?.direccionDestino,
        ganancia: Number(pedido?.ganancia ?? pedido?.valorDomicilio ?? 0),
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);

      this.logger.error(
        `No se pudo notificar al domiciliario del pedido ${pedidoId}: ${msg}`,
      );
    }
  }

  private async notifyAdminPedidoTomado(pedido: Pedido, domiciliarioId: string) {
    try {
      const d = await this.usuariosService.findOne(domiciliarioId);

      await this.notificationsService.notifyAdminPedidoTomado({
        adminId: pedido.assignedBy,
        domiciliarioNombre: d.nombre,
        pedidoId: pedido.id,
        comercioNombre: pedido.comercio?.nombre ?? 'Comercio',
        direccionDestino: pedido.direccionDestino,
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`No se pudo notificar al admin que se tomó el pedido ${pedido.id}: ${msg}`);
    }
  }

  private async notifyAdminEstado(
    adminId: string,
    domiciliarioId: string,
    pedidoId: string,
    estado: PedidoEstado,
    ganancia: number,
  ) {
    try {
      const d = await this.usuariosService.findOne(domiciliarioId);

      await this.notificationsService.notifyAdminEstadoCambiado({
        adminId,
        domiciliarioNombre: d.nombre,
        pedidoId,
        estado,
        ganancia,
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);

      this.logger.error(
        `No se pudo notificar al admin del cambio de estado del pedido ${pedidoId}: ${msg}`,
      );
    }
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
