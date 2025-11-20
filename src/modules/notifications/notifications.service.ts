import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as webpush from 'web-push';
import { PushSubscriptionsRepository } from './repositories/push-subscriptions.repository';
import { CreatePushSubscriptionDto } from './dtos/create-push-subscription.dto';
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly pushRepo: PushSubscriptionsRepository,
  ) {
    const publicKey = this.config.get<string>('WEB_PUSH_PUBLIC_KEY');
    const privateKey = this.config.get<string>('WEB_PUSH_PRIVATE_KEY');
    const subject = this.config.get<string>('WEB_PUSH_SUBJECT');

    if (!publicKey || !privateKey || !subject) {
      this.logger.warn('Faltan WEB_PUSH_PUBLIC_KEY / WEB_PUSH_PRIVATE_KEY / WEB_PUSH_SUBJECT en env');
    } else {
      webpush.setVapidDetails(subject, publicKey, privateKey);
    }
  }

  async subscribe(usuarioId: string, dto: CreatePushSubscriptionDto) {
    return this.pushRepo.upsertForUser(usuarioId, {
      endpoint: dto.endpoint,
      p256dh: dto.keys.p256dh,
      auth: dto.keys.auth,
      expirationTime: dto.expirationTime ?? null,
    });
  }

  async unsubscribe(usuarioId: string, endpoint: string) {
    await this.pushRepo.deleteByEndpointForUser(usuarioId, endpoint);
    return { ok: true };
  }

  async notifyUser(usuarioId: string, payload: any) {
    const subs = await this.pushRepo.findByUser(usuarioId);
    const body = JSON.stringify(payload);

    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            expirationTime: sub.expirationTime ?? undefined,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          } as any,
          body,
        );
      } catch (err: any) {
        const status = err?.statusCode;
        if (status === 410 || status === 404) {
          await this.pushRepo.delete({ endpoint: sub.endpoint });
        } else {
          this.logger.error(`Error enviando push`, err?.stack || err);
        }
      }
    }

    return { ok: true, sent: subs.length };
  }
}
