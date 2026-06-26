import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Usuario } from '../entities/usuario.entity';
import { Rol } from '../enums/rol.enum';
import { Pedido } from '../../pedidos/entities/pedido.entity';
import { PedidoEstado } from '../../pedidos/enums/estado-pedido.enum';

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
        'usuario.disponibilidad',
        'usuario.lastSeenAt',
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

  async sumGananciaDiariaDomiciliario(
    domiciliarioId: string,
    start: Date,
    end: Date,
  ): Promise<number> {
    const result = await this.dataSource
      .createQueryBuilder()
      .select('COALESCE(SUM(pedido.ganancia), 0)', 'total')
      .from(Pedido, 'pedido')
      .where('pedido.estado = :estado', { estado: PedidoEstado.HECHO })
      .andWhere('pedido.updated_at >= :start', { start })
      .andWhere('pedido.updated_at < :end', { end })
      .andWhere(
        '(pedido.usuario_id = :domiciliarioId OR pedido.domiciliario_id = :domiciliarioId)',
        { domiciliarioId },
      )
      .getRawOne<{ total: string | number | null }>();

    return Number(result?.total ?? 0);
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
