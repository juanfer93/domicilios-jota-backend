import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Pedido } from '../entities/pedido.entity';
import { Usuario } from '../../usuarios/entities/usuario.entity';
import { Rol } from '../../usuarios/enums/rol.enum';
import { PedidoEstado } from '../enums/estado-pedido.enum';

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

  async findAllHistory(search: string | undefined, retentionCutoff: Date): Promise<Pedido[]> {
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

  async findAssignmentCandidates(): Promise<DomiciliarioAssignmentCandidate[]> {
    return this.dataSource
      .createQueryBuilder()
      .select('usuario.id', 'id')
      .addSelect('usuario.nombre', 'nombre')
      .addSelect('MAX(COALESCE(pedido.assigned_at, pedido.created_at))', 'lastAssignedAt')
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
      .andWhere('activePedido.id IS NULL')
      .groupBy('usuario.id')
      .addGroupBy('usuario.nombre')
      .getRawMany<DomiciliarioAssignmentCandidate>();
  }
}
