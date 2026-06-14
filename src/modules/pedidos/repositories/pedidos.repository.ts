import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Pedido } from '../entities/pedido.entity';

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
}
