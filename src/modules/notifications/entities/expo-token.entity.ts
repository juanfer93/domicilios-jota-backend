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

/**
 * Almacena tokens Expo Push separadamente de las suscripciones Web Push.
 * El frontend envía: { token, platform, provider: 'EXPO' }
 */
@Entity('expo_tokens')
export class ExpoTokenEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'text' })
  token: string;

  /** 'ios' | 'android' | 'web' — viene del Platform.OS de React Native */
  @Column({ type: 'varchar', length: 20 })
  platform: string;

  @Column({ name: 'usuario_id', type: 'uuid' })
  usuarioId: string;

  @ManyToOne(() => Usuario, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'usuario_id' })
  usuario: Usuario;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
