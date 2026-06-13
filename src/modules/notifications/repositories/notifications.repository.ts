import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { NotificationEntity } from '../entities/notification.entity';

@Injectable()
export class NotificationsRepository extends Repository<NotificationEntity> {
  constructor(private dataSource: DataSource) {
    super(NotificationEntity, dataSource.createEntityManager());
  }

  async saveNotification(data: {
    destinatarioId: string;
    pedidoId: string | null;
    tipo: NotificationEntity['tipo'];
    titulo: string;
    cuerpo: string;
    datos: Record<string, unknown>;
  }): Promise<NotificationEntity> {
    const entity = this.create({
      destinatarioId: data.destinatarioId,
      pedidoId: data.pedidoId,
      tipo: data.tipo,
      titulo: data.titulo,
      cuerpo: data.cuerpo,
      datos: data.datos,
      readAt: null,
    });
    return this.save(entity);
  }

  async markAsRead(id: string, destinatarioId: string): Promise<NotificationEntity | null> {
    const notification = await this.findOne({
      where: { id, destinatarioId },
    });

    if (!notification) return null;

    notification.readAt = new Date();
    return this.save(notification);
  }

  async findByDestinatario(destinatarioId: string): Promise<NotificationEntity[]> {
    return this.find({
      where: { destinatarioId },
      order: { createdAt: 'DESC' },
    });
  }
}
