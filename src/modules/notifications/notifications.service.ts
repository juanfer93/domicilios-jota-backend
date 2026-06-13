import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as webpush from 'web-push';
import { PushSubscriptionsRepository } from './repositories/push-subscriptions.repository';
import { NotificationsRepository } from './repositories/notifications.repository';
import { ExpoTokensRepository } from './repositories/expo-tokens.repository';
import { CreatePushSubscriptionDto } from './dtos/create-push-subscription.dto';
import { NotificationEntity } from './entities/notification.entity';

/** Espejo exacto de NotificationPayload del frontend */
export interface NotificationPayload {
  notificationId?: string;
  type?: NotificationEntity['tipo'];
  pedidoId?: string;
  title?: string;
  body?: string;
  url?: string;
  estado?: string;
  domiciliarioId?: string;
  domiciliarioNombre?: string;
  createdAt?: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly pushRepo: PushSubscriptionsRepository,
    private readonly notificationsRepo: NotificationsRepository,
    private readonly expoTokensRepo: ExpoTokensRepository,
  ) {
    const publicKey = this.config.get<string>('WEB_PUSH_PUBLIC_KEY');
    const privateKey = this.config.get<string>('WEB_PUSH_PRIVATE_KEY');
    const subject = this.config.get<string>('WEB_PUSH_SUBJECT');

    if (!publicKey || !privateKey || !subject) {
      this.logger.warn(
        'Faltan WEB_PUSH_PUBLIC_KEY / WEB_PUSH_PRIVATE_KEY / WEB_PUSH_SUBJECT en env',
      );
    } else {
      webpush.setVapidDetails(subject, publicKey, privateKey);
    }
  }

  // ─── WEB PUSH ─────────────────────────────────────────────────────────────

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

  /** Retorna la llave pública VAPID para que el cliente la use al suscribirse */
  getWebPushPublicKey(): { publicKey: string } {
    const publicKey = this.config.get<string>('WEB_PUSH_PUBLIC_KEY') ?? '';
    return { publicKey };
  }

  // ─── EXPO TOKENS ──────────────────────────────────────────────────────────

  async registerExpoToken(
    usuarioId: string,
    token: string,
    platform: string,
  ): Promise<{ ok: boolean }> {
    await this.expoTokensRepo.upsertForUser(usuarioId, token, platform);
    return { ok: true };
  }

  // ─── MARK AS READ ─────────────────────────────────────────────────────────

  async markAsRead(
    notificationId: string,
    usuarioId: string,
  ): Promise<NotificationEntity> {
    const notification = await this.notificationsRepo.markAsRead(
      notificationId,
      usuarioId,
    );

    if (!notification) {
      throw new NotFoundException(
        `Notificación ${notificationId} no encontrada o no pertenece al usuario.`,
      );
    }

    return notification;
  }

  // ─── NOTIFY USER (Web Push) ───────────────────────────────────────────────

  /**
   * Envía un Web Push a todas las suscripciones del usuario.
   * También puede persistir la notificación si se proporcionan los datos necesarios.
   */
  async notifyUser(
    usuarioId: string,
    payload: NotificationPayload,
    persistOptions?: {
      tipo: NotificationEntity['tipo'];
      titulo: string;
      cuerpo: string;
      pedidoId?: string | null;
    },
  ) {
    // 1. Persistir en tabla notifications si se pidió
    let savedNotification: NotificationEntity | undefined;
    if (persistOptions) {
      savedNotification = await this.notificationsRepo.saveNotification({
        destinatarioId: usuarioId,
        pedidoId: persistOptions.pedidoId ?? null,
        tipo: persistOptions.tipo,
        titulo: persistOptions.titulo,
        cuerpo: persistOptions.cuerpo,
        datos: { ...payload },
      });
    }

    // 2. Incluir el notificationId en el payload si fue guardada
    const fullPayload: NotificationPayload = {
      ...payload,
      notificationId: savedNotification?.id ?? payload.notificationId,
      createdAt:
        savedNotification?.createdAt?.toISOString() ??
        payload.createdAt ??
        new Date().toISOString(),
    };

    // 3. Enviar Web Push
    const subs = await this.pushRepo.findByUser(usuarioId);
    const body = JSON.stringify(fullPayload);

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
          this.logger.error(`Error enviando Web Push`, err?.stack || err);
        }
      }
    }

    // 4. Enviar Expo Push si el usuario tiene tokens registrados
    await this.sendExpoPush(usuarioId, {
      title: persistOptions?.titulo ?? fullPayload.title ?? '',
      body: persistOptions?.cuerpo ?? fullPayload.body ?? '',
      data: fullPayload,
    });

    return { ok: true, sent: subs.length };
  }

  // ─── NOTIFY DOMICILIARIO ASIGNADO ─────────────────────────────────────────

  /**
   * Notifica al domiciliario que se le asignó un pedido.
   * Guarda la notificación y envía Push (Expo + Web).
   */
  async notifyDomiciliarioAsignado(params: {
    domiciliarioId: string;
    domiciliarioNombre: string;
    pedidoId: string;
  }): Promise<void> {
    const titulo = 'Nuevo pedido asignado';
    const cuerpo = 'Tienes un nuevo servicio en curso. ¡Revísalo!';

    const payload: NotificationPayload = {
      type: 'PEDIDO_ASIGNADO',
      pedidoId: params.pedidoId,
      title: titulo,
      body: cuerpo,
      url: '/profile-delivery/current-delivery',
      domiciliarioId: params.domiciliarioId,
      domiciliarioNombre: params.domiciliarioNombre,
    };

    await this.notifyUser(params.domiciliarioId, payload, {
      tipo: 'PEDIDO_ASIGNADO',
      titulo,
      cuerpo,
      pedidoId: params.pedidoId,
    });
  }

  // ─── NOTIFY ADMIN ESTADO CAMBIADO ─────────────────────────────────────────

  /**
   * Notifica al admin (assignedBy del pedido) cuando un domiciliario cambia el estado.
   * Si el pedido no tiene assignedBy, no hace nada.
   */
  async notifyAdminEstadoCambiado(params: {
    adminId: string | null;
    domiciliarioNombre: string;
    pedidoId: string;
    estado: string;
  }): Promise<void> {
    if (!params.adminId) return;

    const titulo = `Pedido actualizado`;
    const cuerpo = `${params.domiciliarioNombre} cambió el estado a ${params.estado}.`;

    const payload: NotificationPayload = {
      type: 'PEDIDO_ESTADO_ACTUALIZADO',
      pedidoId: params.pedidoId,
      title: titulo,
      body: cuerpo,
      estado: params.estado,
      domiciliarioNombre: params.domiciliarioNombre,
    };

    await this.notifyUser(params.adminId, payload, {
      tipo: 'PEDIDO_ESTADO_ACTUALIZADO',
      titulo,
      cuerpo,
      pedidoId: params.pedidoId,
    });
  }

  // ─── EXPO PUSH (interno) ──────────────────────────────────────────────────

  private async sendExpoPush(
    usuarioId: string,
    message: { title: string; body: string; data: NotificationPayload },
  ): Promise<void> {
    const tokens = await this.expoTokensRepo.findByUser(usuarioId);
    if (tokens.length === 0) return;

    const messages = tokens.map((t) => ({
      to: t.token,
      sound: 'default' as const,
      title: message.title,
      body: message.body,
      data: message.data,
    }));

    try {
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messages),
      });

      if (!response.ok) {
        const text = await response.text();
        this.logger.error(`Expo Push error ${response.status}: ${text}`);
      }
    } catch (err: unknown) {
      const message_err = err instanceof Error ? err.message : String(err);
      this.logger.error(`Error enviando Expo Push: ${message_err}`);
    }
  }
}
