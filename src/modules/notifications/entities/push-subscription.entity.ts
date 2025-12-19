import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  Index,
  JoinColumn,   
} from 'typeorm';
import { Usuario } from '../../usuarios/entities/usuario.entity';

@Entity('push_subscriptions')
export class PushSubscriptionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'text' })
  endpoint: string;

  @Column({ type: 'text' })
  p256dh: string;

  @Column({ type: 'text' })
  auth: string;

  @Column({ name: 'expiration_time', type: 'bigint', nullable: true })
  expirationTime: number | null;

  @ManyToOne(() => Usuario, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'usuario_id' })   // ✅ CLAVE
  usuario: Usuario;

  @Column({ name: 'usuario_id', type: 'uuid' })
  usuarioId: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
