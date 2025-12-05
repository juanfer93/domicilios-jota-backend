import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { Rol } from '../enums/rol.enum';
import { Pedido } from '../../pedidos/entities/pedido.entity';

@Entity('usuarios')
export class Usuario {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  nombre: string;

  @Column({ type: 'varchar', length: 150, unique: true })
  email: string;

  @Exclude()
  @Column({ type: 'text' })
  password: string;

  @Column({ type: 'varchar', length: 20 })
  rol: Rol;

  @Column({ default: false })
  email_confirmado: boolean;

  @Column({ type: 'varchar', nullable: true })
  email_confirmacion_token: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  email_confirmacion_expira: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @OneToMany(() => Pedido, (pedido) => pedido.usuario)
  pedidos: Pedido[];
}