import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { PushSubscriptionEntity } from '../entities/push-subscription.entity';

@Injectable()
export class PushSubscriptionsRepository extends Repository<PushSubscriptionEntity> {
  constructor(private dataSource: DataSource) {
    super(PushSubscriptionEntity, dataSource.createEntityManager());
  }

  async upsertForUser(usuarioId: string, data: {
    endpoint: string;
    p256dh: string;
    auth: string;
    expirationTime?: number | null;
  }) {
    // endpoint único: si existe, actualiza; si no, crea
    const existing = await this.findOne({ where: { endpoint: data.endpoint } });

    if (existing) {
      existing.usuarioId = usuarioId;
      existing.p256dh = data.p256dh;
      existing.auth = data.auth;
      existing.expirationTime = data.expirationTime ?? null;
      return this.save(existing);
    }

    const created = this.create({
      usuarioId,
      endpoint: data.endpoint,
      p256dh: data.p256dh,
      auth: data.auth,
      expirationTime: data.expirationTime ?? null,
    });

    return this.save(created);
  }

  async deleteByEndpointForUser(usuarioId: string, endpoint: string) {
    await this.delete({ usuarioId, endpoint });
  }

  async findByUser(usuarioId: string) {
    return this.find({ where: { usuarioId } });
  }
}
