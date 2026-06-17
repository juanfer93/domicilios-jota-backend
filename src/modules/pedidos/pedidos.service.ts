import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PedidosRepository, DomiciliarioAssignmentCandidate } from './repositories/pedidos.repository';
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
  constructor(private readonly pedidosRepository: PedidosRepository, private readonly notificationsService: NotificationsService, private readonly usuariosService: UsuariosService) {}

  async getPedidosDelDia(usuarioId?: string) {
    const finalCutoff = this.hoursAgo(12);
    const query = this.pedidosRepository.createQueryBuilder('p').leftJoinAndSelect('p.usuario', 'u').leftJoinAndSelect('p.comercio', 'c').where('(p.estado = :activeState OR (p.estado IN (:...finalStates) AND p.updated_at >= :finalCutoff))', { activeState: PedidoEstado.EN_PROCESO, finalStates: [PedidoEstado.HECHO, PedidoEstado.CANCELADO], finalCutoff });
    if (usuarioId) query.andWhere('p.usuario_id = :usuarioId', { usuarioId });
    return query.orderBy('p.updated_at', 'DESC').getMany();
  }

  async createPedidoByAdmin(dto: CreatePedidoAdminDto, adminId: string) {
    const domiciliarioId = await this.resolveDomiciliarioId(dto);
    const pedido = this.pedidosRepository.create({ usuarioId: domiciliarioId, comercioId: dto.comercioId, valorFinal: dto.valorFinal, valorDomicilio: dto.valorDomicilio ?? 0, direccionDestino: dto.direccionDestino, direccionRecogida: dto.direccionRecogida, valorPedido: dto.valorPedido, clienteNombre: dto.clienteNombre, clienteTelefono: dto.clienteTelefono, domiciliarioId, direccionEntrega: dto.direccionEntrega, detallesAdicionales: dto.detallesAdicionales, estado: PedidoEstado.EN_PROCESO, assignedBy: adminId, assignedAt: new Date() });
    const pedidoGuardado = await this.pedidosRepository.save(pedido);
    void this.notifyAssignedDomiciliario(domiciliarioId, pedidoGuardado.id);
    return pedidoGuardado;
  }

  async updateEstadoPedido(pedidoId: string, estado: PedidoEstado, actor: { id: string; rol: Rol }): Promise<Pedido | null> {
    const pedido = await this.pedidosRepository.findOne({ where: { id: pedidoId }, relations: ['usuario'] });
    if (!pedido) throw new NotFoundException(`Pedido con ID ${pedidoId} no encontrado`);
    if ((pedido.estado === PedidoEstado.HECHO || pedido.estado === PedidoEstado.CANCELADO) && pedido.estado !== estado) throw new BadRequestException('No se puede cambiar el estado de un pedido finalizado.');
    if (actor.rol === Rol.DOMICILIARIO && pedido.domiciliarioId !== actor.id) throw new ForbiddenException('No tienes permiso para modificar este pedido.');
    await this.pedidosRepository.update(pedidoId, { estado });
    if (actor.rol === Rol.DOMICILIARIO && pedido.assignedBy) void this.notifyAdminEstado(pedido.assignedBy, actor.id, pedidoId, estado);
    return this.pedidosRepository.findOne({ where: { id: pedidoId } });
  }

  async getHistorialByDate(date: string) {
    const { start, end } = this.getColombiaRange(date); const retentionCutoff = this.daysAgo(60); if (end <= retentionCutoff) return [];
    return this.pedidosRepository.createQueryBuilder('p').leftJoinAndSelect('p.usuario', 'u').leftJoinAndSelect('p.comercio', 'c').where('p.created_at >= :start AND p.created_at < :end', { start: start > retentionCutoff ? start : retentionCutoff, end }).orderBy('p.created_at', 'DESC').getMany();
  }

  async getAllHistory(search?: string) { const normalizedSearch = search?.trim(); return this.pedidosRepository.findAllHistory(normalizedSearch || undefined, this.daysAgo(60)); }

  async getHistorialDomiciliarioByDate(date: string, usuarioId: string) {
    const { start, end } = this.getColombiaRange(date);
    return this.pedidosRepository.createQueryBuilder('p').leftJoinAndSelect('p.usuario', 'u').leftJoinAndSelect('p.comercio', 'c').where('p.created_at >= :start AND p.created_at < :end AND p.usuario_id = :usuarioId', { start, end, usuarioId }).orderBy('p.created_at', 'DESC').getMany();
  }

  async getHistorialDomiciliarioUltimos60Dias(usuarioId: string) {
    return this.pedidosRepository.createQueryBuilder('p').leftJoinAndSelect('p.usuario', 'u').leftJoinAndSelect('p.comercio', 'c').where('p.created_at >= :retentionCutoff AND p.usuario_id = :usuarioId', { retentionCutoff: this.daysAgo(60), usuarioId }).orderBy('p.created_at', 'DESC').getMany();
  }

  async getCurrentPedidoForDomiciliario(usuarioId: string) {
    const pedidos = await this.pedidosRepository.find({ where: { usuario: { id: usuarioId }, estado: PedidoEstado.EN_PROCESO }, relations: ['usuario', 'comercio'], order: { createdAt: 'DESC' }, take: 1 });
    return pedidos[0] ?? null;
  }

  private async resolveDomiciliarioId(dto: CreatePedidoAdminDto): Promise<string> {
    const manualId = dto.domiciliarioId ?? dto.usuarioId; if (manualId) return manualId;
    const selected = this.pickAssignmentCandidate(await this.pedidosRepository.findAssignmentCandidates());
    if (!selected) throw new BadRequestException('Todos los domiciliarios están ocupados o no hay domiciliarios disponibles. Intenta crear el pedido cuando alguno finalice su pedido actual.');
    return selected.id;
  }

  private pickAssignmentCandidate(candidates: DomiciliarioAssignmentCandidate[]): DomiciliarioAssignmentCandidate | null {
    if (candidates.length === 0) return null;
    const ranked = candidates.map((candidate) => ({ candidate, lastTime: this.toAssignmentTime(candidate.lastAssignedAt) }));
    const oldestTime = Math.min(...ranked.map((item) => item.lastTime));
    const tied = ranked.filter((item) => item.lastTime === oldestTime);
    return tied[Math.floor(Math.random() * tied.length)]?.candidate ?? null;
  }

  private async notifyAssignedDomiciliario(domiciliarioId: string, pedidoId: string) {
    try { const d = await this.usuariosService.findOne(domiciliarioId); await this.notificationsService.notifyDomiciliarioAsignado({ domiciliarioId: d.id, domiciliarioNombre: d.nombre, pedidoId }); }
    catch (error: unknown) { const msg = error instanceof Error ? error.message : String(error); this.logger.error(`No se pudo notificar al domiciliario del pedido ${pedidoId}: ${msg}`); }
  }

  private async notifyAdminEstado(adminId: string, domiciliarioId: string, pedidoId: string, estado: PedidoEstado) {
    try { const d = await this.usuariosService.findOne(domiciliarioId); await this.notificationsService.notifyAdminEstadoCambiado({ adminId, domiciliarioNombre: d.nombre, pedidoId, estado }); }
    catch (error: unknown) { const msg = error instanceof Error ? error.message : String(error); this.logger.error(`No se pudo notificar al admin del cambio de estado del pedido ${pedidoId}: ${msg}`); }
  }

  private toAssignmentTime(value: Date | string | null): number { if (!value) return 0; const time = value instanceof Date ? value.getTime() : new Date(value).getTime(); return Number.isFinite(time) ? time : 0; }
  private getColombiaRange(date: string) { try { return getColombiaDayRange(date); } catch { throw new BadRequestException('La fecha debe usar el formato YYYY-MM-DD.'); } }
  private hoursAgo(hours: number) { return new Date(Date.now() - hours * 60 * 60 * 1000); }
  private daysAgo(days: number) { return new Date(Date.now() - days * 24 * 60 * 60 * 1000); }
}
