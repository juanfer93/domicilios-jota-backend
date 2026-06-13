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

  async findDomiciliariosByNombre(nombre: string): Promise<Usuario[]> {
    return this.createQueryBuilder('usuario')
      .where('usuario.rol = :rol', { rol: Rol.DOMICILIARIO })
      .andWhere('LOWER(usuario.nombre) LIKE LOWER(:nombre)', {
        nombre: `%${nombre}%`,
      })
      .select([
        'usuario.id',
        'usuario.nombre',
        'usuario.email',
        'usuario.bloqueado',
        'usuario.createdAt',
      ])
      .orderBy('usuario.nombre', 'ASC')
      .getMany();
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
