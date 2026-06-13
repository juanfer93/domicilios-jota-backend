import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Pedido } from '../entities/pedido.entity';

@Injectable()
export class PedidosRepository extends Repository<Pedido> {
  constructor(private dataSource: DataSource) {
    super(Pedido, dataSource.createEntityManager());
  }

  async findAllHistory(search?: string): Promise<Pedido[]> {
    const queryBuilder = this.createQueryBuilder('pedido')
      .leftJoinAndSelect('pedido.usuario', 'usuario')
      .leftJoinAndSelect('pedido.comercio', 'comercio');

    if (search) {
      queryBuilder.andWhere(
        '(LOWER(usuario.nombre) LIKE LOWER(:search) OR LOWER(comercio.nombre) LIKE LOWER(:search))',
        { search: `%${search}%` },
      );
    }

    return queryBuilder.orderBy('pedido.createdAt', 'DESC').getMany();
  }
}
