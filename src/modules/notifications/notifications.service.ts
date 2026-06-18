import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as webpush from 'web-push';
import { PushSubscriptionsRepository } from './repositories/push-subscriptions.repository';
import { NotificationsRepository } from './repositories/notifications.repository';
import { ExpoTokensRepository } from './repositories/expo-tokens.repository';
import { CreatePushSubscriptionDto } from './dtos/create-push-subscription.dto';
import { NotificationEntity } from './entities/notification.entity';

const ORDERS_CHANNEL_ID = 'orders-v3';

export interface NotificationPayload {
  notificationId?: string;
  type?: NotificationEntity['tipo'] | 'PEDIDO_DISPONIBLE' | 'PEDIDO_TOMADO';
  pedidoId?: string;
  title?: string;
  body?: string;
  url?: string;
  estado?: string;
  domiciliarioId?: string;
  domiciliarioNombre?: string;
  comercioNombre?: string;
  direccionRecogida?: string;
  direccionDestino?: string;
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

  getWebPushPublicKey(): { publicKey: string } {
    return {
      publicKey: this.config.get<string>('WEB_PUSH_PUBLIC_KEY') ?? '',
    };
  }

  async registerExpoToken(
    usuarioId: string,
    token: string,
    platform: 'android',
  ): Promise<{ ok: boolean }> {
    await this.expoTokensRepo.upsertForUser(usuarioId, token, platform);
    this.logger.log(`Expo token registrado para usuario ${usuarioId}`);
    return { ok: true };
  }

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

    const fullPayload: NotificationPayload = {
      ...payload,
      notificationId: savedNotification?.id ?? payload.notificationId,
      createdAt:
        savedNotification?.createdAt?.toISOString() ??
        payload.createdAt ??
        new Date().toISOString(),
    };

    const subs = await this.pushRepo.findByUser(usuarioId);
    const body = JSON.stringify(fullPayload);

    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            expirationTime: sub.expirationTime ?? undefined,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
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

    const expoSent = await this.sendExpoPush(usuarioId, {
      title: persistOptions?.titulo ?? fullPayload.title ?? '',
      body: persistOptions?.cuerpo ?? fullPayload.body ?? '',
      data: fullPayload,
    });

    return {
      ok: true,
      sent: subs.length,
      expoSent,
    };
  }

  async notifyPedidoDisponible(params: {
    domiciliarioIds: string[];
    pedidoId: string;
    comercioNombre: string;
    direccionRecogida: string;
    direccionDestino: string;
  }): Promise<void> {
    const titulo = 'Nuevo pedido disponible';
    const cuerpo = `Recoger en ${params.comercioNombre}. Entregar en ${params.direccionDestino}.`;

    await Promise.all(
      params.domiciliarioIds.map((domiciliarioId) =>
        this.notifyUser(
          domiciliarioId,
          {
            type: 'PEDIDO_DISPONIBLE',
            pedidoId: params.pedidoId,
            title: titulo,
            body: cuerpo,
            url: '/profile',
            comercioNombre: params.comercioNombre,
            direccionRecogida: params.direccionRecogida,
            direccionDestino: params.direccionDestino,
          },
          {
            tipo: 'PEDIDO_DISPONIBLE' as NotificationEntity['tipo'],
            titulo,
            cuerpo,
            pedidoId: params.pedidoId,
          },
        ),
      ),
    );
  }

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
      url: '/profile/current-delivery',
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

  async notifyAdminPedidoTomado(params: {
    adminId: string | null;
    domiciliarioNombre: string;
    pedidoId: string;
    comercioNombre: string;
    direccionDestino: string;
  }): Promise<void> {
    if (!params.adminId) {
      return;
    }

    const titulo = 'Pedido tomado';
    const cuerpo = `${params.domiciliarioNombre} cogio el pedido de ${params.comercioNombre} para ${params.direccionDestino}.`;

    await this.notifyUser(
      params.adminId,
      {
        type: 'PEDIDO_TOMADO',
        pedidoId: params.pedidoId,
        title: titulo,
        body: cuerpo,
        domiciliarioNombre: params.domiciliarioNombre,
        comercioNombre: params.comercioNombre,
        direccionDestino: params.direccionDestino,
        url: `/delivery?pedidoId=${params.pedidoId}`,
      },
      {
        tipo: 'PEDIDO_TOMADO' as NotificationEntity['tipo'],
        titulo,
        cuerpo,
        pedidoId: params.pedidoId,
      },
    );
  }

  async notifyAdminEstadoCambiado(params: {
    adminId: string | null;
    domiciliarioNombre: string;
    pedidoId: string;
    estado: string;
  }): Promise<void> {
    if (!params.adminId) {
      return;
    }

    const titulo = `Pedido actualizado`;
    const cuerpo = `${params.domiciliarioNombre} cambió el estado a ${params.estado}.`;

    const payload: NotificationPayload = {
      type: 'PEDIDO_ESTADO_ACTUALIZADO',
      pedidoId: params.pedidoId,
      title: titulo,
      body: cuerpo,
      estado: params.estado,
      domiciliarioNombre: params.domiciliarioNombre,
      url: `/delivery?pedidoId=${params.pedidoId}`,
    };

    await this.notifyUser(params.adminId, payload, {
      tipo: 'PEDIDO_ESTADO_ACTUALIZADO',
      titulo,
      cuerpo,
      pedidoId: params.pedidoId,
    });
  }

  private async sendExpoPush(
    usuarioId: string,
    message: {
      title: string;
      body: string;
      data: NotificationPayload;
    },
  ): Promise<number> {
    const tokens = await this.expoTokensRepo.findByUser(usuarioId);

    if (tokens.length === 0) {
      this.logger.warn(`Usuario ${usuarioId} no tiene tokens Expo registrados`);
      return 0;
    }

    const messages = tokens.map((t) => ({
      to: t.token,
      sound: 'default',
      channelId: ORDERS_CHANNEL_ID,
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

      const rawText =
        typeof (response as any).text === 'function'
          ? await response.text()
          : '';

      if (!response.ok) {
        this.logger.error(`Expo Push error ${response.status}: ${rawText}`);
        return 0;
      }

      if (!rawText) {
        this.logger.log(
          `Expo Push enviado a usuario ${usuarioId} con canal ${ORDERS_CHANNEL_ID}`,
        );
        return messages.length;
      }

      let parsed: any;

      try {
        parsed = JSON.parse(rawText);
      } catch {
        this.logger.warn(`Expo Push respondió sin JSON válido: ${rawText}`);
        return messages.length;
      }

      const tickets = Array.isArray(parsed) ? parsed : parsed?.data ?? [];

      for (const ticket of tickets) {
        if (ticket?.status === 'error') {
          this.logger.error(
            `Expo Push ticket error: ${ticket?.message || 'sin mensaje'} ${JSON.stringify(
              ticket?.details ?? {},
            )}`,
          );
        }
      }

      return messages.length;
    } catch (err: unknown) {
      const messageError = err instanceof Error ? err.message : String(err);
      this.logger.error(`Error enviando Expo Push: ${messageError}`);
      return 0;
    }
  }
}
