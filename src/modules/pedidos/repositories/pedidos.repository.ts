import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Pedido } from '../entities/pedido.entity';
import { Usuario } from '../../usuarios/entities/usuario.entity';
import { Rol } from '../../usuarios/enums/rol.enum';
import { DisponibilidadDomiciliario } from '../../usuarios/enums/disponibilidad-domiciliario.enum';
import { PedidoEstado } from '../enums/estado-pedido.enum';

const COURIER_PRESENCE_TTL_MS = 2 * 60 * 1000;

export interface DomiciliarioAssignmentCandidate {
  id: string;
  nombre: string;
  lastAssignedAt: Date | string | null;
}

@Injectable()
export class PedidosRepository extends Repository<Pedido> {
  constructor(private dataSource: DataSource) {
    super(Pedido, dataSource.createEntityManager());
  }

  async findAllHistory(
    search: string | undefined,
    retentionCutoff: Date,
  ): Promise<Pedido[]> {
    const queryBuilder = this.createQueryBuilder('pedido')
      .leftJoinAndSelect('pedido.usuario', 'usuario')
      .leftJoinAndSelect('pedido.comercio', 'comercio')
      .where('pedido.created_at >= :retentionCutoff', { retentionCutoff });

    if (search) {
      queryBuilder.andWhere(
        '(LOWER(usuario.nombre) LIKE LOWER(:search) OR LOWER(comercio.nombre) LIKE LOWER(:search))',
        { search: `%${search}%` },
      );
    }

    return queryBuilder.orderBy('pedido.createdAt', 'DESC').getMany();
  }

  async findAvailablePedidos(): Promise<Pedido[]> {
    return this.createQueryBuilder('pedido')
      .leftJoinAndSelect('pedido.usuario', 'usuario')
      .leftJoinAndSelect('pedido.comercio', 'comercio')
      .where('pedido.estado = :estado', { estado: PedidoEstado.EN_PROCESO })
      .andWhere('pedido.usuario_id IS NULL')
      .andWhere('pedido.domiciliario_id IS NULL')
      .orderBy('pedido.created_at', 'ASC')
      .getMany();
  }

  async takeAvailablePedido(
    pedidoId: string,
    domiciliarioId: string,
  ): Promise<Pedido | null> {
    const result = await this.createQueryBuilder()
      .update(Pedido)
      .set({
        usuarioId: domiciliarioId,
        domiciliarioId,
        assignedAt: new Date(),
      })
      .where('id = :pedidoId', { pedidoId })
      .andWhere('estado = :estado', { estado: PedidoEstado.EN_PROCESO })
      .andWhere('usuario_id IS NULL')
      .andWhere('domiciliario_id IS NULL')
      .execute();

    if (!result.affected) {
      return null;
    }

    return this.findOne({
      where: { id: pedidoId },
      relations: ['usuario', 'comercio'],
    });
  }

  async findAssignmentCandidates(): Promise<DomiciliarioAssignmentCandidate[]> {
    return this.createAvailableCourierQuery().getRawMany<DomiciliarioAssignmentCandidate>();
  }

  async findAvailableCourierById(
    domiciliarioId: string,
  ): Promise<DomiciliarioAssignmentCandidate | null> {
    const result = await this.createAvailableCourierQuery()
      .andWhere('usuario.id = :domiciliarioId', { domiciliarioId })
      .getRawOne<DomiciliarioAssignmentCandidate>();

    return result ?? null;
  }

  private createAvailableCourierQuery() {
    const connectedAfter = new Date(Date.now() - COURIER_PRESENCE_TTL_MS);

    return this.dataSource
      .createQueryBuilder()
      .select('usuario.id', 'id')
      .addSelect('usuario.nombre', 'nombre')
      .addSelect(
        'MAX(COALESCE(pedido.assigned_at, pedido.created_at))',
        'lastAssignedAt',
      )
      .from(Usuario, 'usuario')
      .leftJoin(Pedido, 'pedido', 'pedido.usuario_id = usuario.id')
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
      .andWhere('activePedido.id IS NULL')
      .groupBy('usuario.id')
      .addGroupBy('usuario.nombre');
  }
}
