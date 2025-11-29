import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Comercio } from '../entities/comercio.entity';

@Injectable()
export class ComerciosRepository extends Repository<Comercio> {
  constructor(private dataSource: DataSource) {
    super(Comercio, dataSource.createEntityManager());
  }

  async findByNombre(nombre: string): Promise<Comercio[]> {
    return this.createQueryBuilder('comercio')
      .where('LOWER(comercio.nombre) LIKE LOWER(:nombre)', {
        nombre: `%${nombre}%`,
      })
      .getMany();
  }

  async findByIdWithPedidos(id: string): Promise<Comercio | null> {
    return this.findOne({
      where: { id },
      relations: ['pedidos'],
    });
  }
}