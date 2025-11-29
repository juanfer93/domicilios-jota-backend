import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Pedido } from '../entities/pedido.entity';
import { FilterPedidosDto } from '../dto/filter-pedidos.dto';

@Injectable()
export class PedidosRepository extends Repository<Pedido> {
  constructor(private dataSource: DataSource) {
    super(Pedido, dataSource.createEntityManager());
  }

  async findWithFilters(filters: FilterPedidosDto): Promise<Pedido[]> {
    const queryBuilder = this.createQueryBuilder('pedido')
      .leftJoinAndSelect('pedido.usuario', 'usuario')
      .leftJoinAndSelect('pedido.comercio', 'comercio');

    if (filters.estado) {
      queryBuilder.andWhere('pedido.estado = :estado', {
        estado: filters.estado,
      });
    }

    if (filters.comercioId) {
      queryBuilder.andWhere('pedido.comercioId = :comercioId', {
        comercioId: filters.comercioId,
      });
    }

    if (filters.usuarioId) {
      queryBuilder.andWhere('pedido.usuarioId = :usuarioId', {
        usuarioId: filters.usuarioId,
      });
    }

    return queryBuilder.orderBy('pedido.createdAt', 'DESC').getMany();
  }

  async findByUsuario(usuarioId: string): Promise<Pedido[]> {
    return this.find({
      where: { usuarioId },
      relations: ['comercio'],
      order: { createdAt: 'DESC' },
    });
  }

  async findByIdWithRelations(id: string): Promise<Pedido | null> {
    return this.findOne({
      where: { id },
      relations: ['usuario', 'comercio'],
    });
  }
}