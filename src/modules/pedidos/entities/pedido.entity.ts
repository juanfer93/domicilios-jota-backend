import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Usuario } from '../../usuarios/entities/usuario.entity';
import { Comercio } from '../../comercios/entities/comercio.entity';
import { EstadoPedido } from '../enums/estado-pedido.enum';

@Entity('pedidos')
export class Pedido {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'usuario_id', type: 'uuid' })
  usuarioId: string;

  @Column({ name: 'comercio_id', type: 'uuid' })
  comercioId: string;

  @Column({
    name: 'valor_domicilio',
    type: 'decimal',
    precision: 10,
    scale: 2,
  })
  valorDomicilio: number;

  @Column({
    name: 'valor_final',
    type: 'decimal',
    precision: 10,
    scale: 2,
  })
  valorFinal: number;

  @Column({ type: 'varchar', length: 20 })
  estado: EstadoPedido;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => Usuario, (usuario) => usuario.pedidos, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'usuario_id' })
  usuario: Usuario;

  @ManyToOne(() => Comercio, (comercio) => comercio.pedidos, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'comercio_id' })
  comercio: Comercio;
}