import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  JoinColumn,
} from 'typeorm';
import { Usuario } from '../../usuarios/entities/usuario.entity';

export type NotificationKind =
  | 'PEDIDO_ASIGNADO'
  | 'PEDIDO_ESTADO_ACTUALIZADO';

@Entity('notifications')
export class NotificationEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Quién recibe la notificación */
  @Column({ name: 'destinatario_id', type: 'uuid' })
  destinatarioId: string;

  @ManyToOne(() => Usuario, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'destinatario_id' })
  destinatario: Usuario;

  /** Pedido relacionado (opcional) */
  @Column({ name: 'pedido_id', type: 'uuid', nullable: true })
  pedidoId: string | null;

  /** Tipo de notificación — espejo exacto de NotificationKind del frontend */
  @Column({ name: 'tipo', type: 'varchar', length: 60 })
  tipo: NotificationKind;

  /** Título visible en la push */
  @Column({ name: 'titulo', type: 'varchar', length: 255 })
  titulo: string;

  /** Cuerpo del mensaje */
  @Column({ name: 'cuerpo', type: 'text' })
  cuerpo: string;

  /**
   * Payload JSON completo que se envía al cliente:
   * notificationId, type, pedidoId, estado, domiciliarioId, domiciliarioNombre, url…
   */
  @Column({ name: 'datos', type: 'jsonb', default: '{}' })
  datos: Record<string, unknown>;

  /** Fecha en que el destinatario la marcó como leída */
  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  readAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
