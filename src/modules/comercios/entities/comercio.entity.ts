import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { Pedido } from '../../pedidos/entities/pedido.entity';

@Entity('comercios')
export class Comercio {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 150 })
  nombre: string;

  @Column({ type: 'text' })
  direccion: string;

  @Column({
    name: 'valor_domicilio',
    type: 'decimal',
    precision: 10,
    scale: 2,
  })
  valorDomicilio: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @OneToMany(() => Pedido, (pedido) => pedido.comercio)
  pedidos: Pedido[];
}