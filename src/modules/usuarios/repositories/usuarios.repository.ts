import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Usuario } from '../entities/usuario.entity';
import { Rol } from '../enums/rol.enum';

@Injectable()
export class UsuariosRepository extends Repository<Usuario> {
  constructor(private dataSource: DataSource) {
    super(Usuario, dataSource.createEntityManager());
  }

  async findByEmail(email: string): Promise<Usuario | null> {
    return this.findOne({ where: { email } });
  }

  async findByIdWithPedidos(id: string): Promise<Usuario | null> {
    return this.findOne({
      where: { id },
      relations: ['pedidos', 'pedidos.comercio'],
    });
  }

  async existsByEmail(email: string): Promise<boolean> {
    const count = await this.count({ where: { email } });
    return count > 0;
  }

  async hasAdmin(): Promise<boolean> {
    const count = await this.count({ where: { rol: Rol.ADMIN } });
    return count > 0;
  }
}