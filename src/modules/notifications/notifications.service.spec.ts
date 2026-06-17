import { NotFoundException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsRepository } from './repositories/notifications.repository';
import { ExpoTokensRepository } from './repositories/expo-tokens.repository';
import { PushSubscriptionsRepository } from './repositories/push-subscriptions.repository';
import { ConfigService } from '@nestjs/config';
import { NotificationEntity } from './entities/notification.entity';
import * as webpush from 'web-push';

jest.mock('web-push', () => ({
  setVapidDetails: jest.fn(),
  sendNotification: jest.fn(),
}));

const sendWebPushMock = webpush.sendNotification as jest.MockedFunction<typeof webpush.sendNotification>;
const makeConfig = (overrides: Record<string, string> = {}) => ({ get: jest.fn((key: string) => overrides[key] ?? undefined) });
const makePushRepo = () => ({ upsertForUser: jest.fn(), deleteByEndpointForUser: jest.fn(), findByUser: jest.fn().mockResolvedValue([]), delete: jest.fn() });
const makeNotificationsRepo = () => ({ saveNotification: jest.fn(), markAsRead: jest.fn(), findByDestinatario: jest.fn() });
const makeExpoTokensRepo = () => ({ upsertForUser: jest.fn(), findByUser: jest.fn().mockResolvedValue([]) });

describe('NotificationsService', () => {
  let service: NotificationsService;
  let pushRepo: ReturnType<typeof makePushRepo>;
  let notificationsRepo: ReturnType<typeof makeNotificationsRepo>;
  let expoTokensRepo: ReturnType<typeof makeExpoTokensRepo>;

  beforeEach(() => {
    jest.clearAllMocks();
    pushRepo = makePushRepo();
    notificationsRepo = makeNotificationsRepo();
    expoTokensRepo = makeExpoTokensRepo();
    service = new NotificationsService(makeConfig() as unknown as ConfigService, pushRepo as unknown as PushSubscriptionsRepository, notificationsRepo as unknown as NotificationsRepository, expoTokensRepo as unknown as ExpoTokensRepository);
  });

  describe('registerExpoToken', () => {
    it('guarda el token Expo para el usuario', async () => {
      expoTokensRepo.upsertForUser.mockResolvedValue({ id: 'token-id' });
      const result = await service.registerExpoToken('user-uuid', 'ExponentPushToken[xxxx]', 'android');
      expect(expoTokensRepo.upsertForUser).toHaveBeenCalledWith('user-uuid', 'ExponentPushToken[xxxx]', 'android');
      expect(result).toEqual({ ok: true });
    });
  });

  describe('getWebPushPublicKey', () => {
    it('retorna la clave publica VAPID desde la config', () => {
      const svc = new NotificationsService(makeConfig({ WEB_PUSH_PUBLIC_KEY: 'mi-clave-publica' }) as unknown as ConfigService, pushRepo as unknown as PushSubscriptionsRepository, notificationsRepo as unknown as NotificationsRepository, expoTokensRepo as unknown as ExpoTokensRepository);
      expect(svc.getWebPushPublicKey()).toEqual({ publicKey: 'mi-clave-publica' });
    });

    it('retorna string vacio si no hay clave configurada', () => {
      expect(service.getWebPushPublicKey()).toEqual({ publicKey: '' });
    });
  });

  describe('markAsRead', () => {
    it('marca la notificacion como leida y la retorna', async () => {
      const notification: Partial<NotificationEntity> = { id: 'notif-uuid', destinatarioId: 'user-uuid', readAt: new Date() };
      notificationsRepo.markAsRead.mockResolvedValue(notification);
      const result = await service.markAsRead('notif-uuid', 'user-uuid');
      expect(notificationsRepo.markAsRead).toHaveBeenCalledWith('notif-uuid', 'user-uuid');
      expect(result).toBe(notification);
    });

    it('lanza NotFoundException si la notificacion no existe o no pertenece al usuario', async () => {
      notificationsRepo.markAsRead.mockResolvedValue(null);
      await expect(service.markAsRead('no-existe', 'user-uuid')).rejects.toThrow(NotFoundException);
    });
  });

  describe('notifyUser para Android', () => {
    it('envia a Expo el canal orders-v2 con sonido custom y el payload persistido', async () => {
      const originalFetch = global.fetch;
      const fetchMock = jest.fn().mockResolvedValue({ ok: true });
      global.fetch = fetchMock as unknown as typeof fetch;
      notificationsRepo.saveNotification.mockResolvedValue({ id: 'notif-id', createdAt: new Date('2026-06-12T18:30:00.000Z') });
      expoTokensRepo.findByUser.mockResolvedValue([{ token: 'ExponentPushToken[android-token]', platform: 'android' }]);

      try {
        await service.notifyUser('user-uuid', { type: 'PEDIDO_ASIGNADO', pedidoId: 'pedido-uuid' }, { tipo: 'PEDIDO_ASIGNADO', titulo: 'Nuevo pedido asignado', cuerpo: 'Tienes un nuevo servicio en curso.', pedidoId: 'pedido-uuid' });
      } finally {
        global.fetch = originalFetch;
      }

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const request = fetchMock.mock.calls[0][1] as RequestInit;
      expect(JSON.parse(request.body as string)).toEqual([
        expect.objectContaining({
          to: 'ExponentPushToken[android-token]',
          channelId: 'orders-v2',
          sound: 'jota-notification.mp3',
          title: 'Nuevo pedido asignado',
          body: 'Tienes un nuevo servicio en curso.',
          data: expect.objectContaining({ notificationId: 'notif-id', pedidoId: 'pedido-uuid', type: 'PEDIDO_ASIGNADO', createdAt: '2026-06-12T18:30:00.000Z' }),
        }),
      ]);
    });
  });

  describe('notifyUser multiplataforma', () => {
    it('envia la misma notificacion a Web Push y Android para el usuario destino', async () => {
      const originalFetch = global.fetch;
      const fetchMock = jest.fn().mockResolvedValue({ ok: true });
      global.fetch = fetchMock as unknown as typeof fetch;
      sendWebPushMock.mockResolvedValue({} as Awaited<ReturnType<typeof webpush.sendNotification>>);
      pushRepo.findByUser.mockResolvedValue([{ endpoint: 'https://push.example/subscription', expirationTime: null, p256dh: 'web-p256dh', auth: 'web-auth' }]);
      expoTokensRepo.findByUser.mockResolvedValue([{ token: 'ExponentPushToken[android-token]', platform: 'android' }]);

      try {
        const result = await service.notifyUser('destinatario-uuid', { type: 'PEDIDO_ASIGNADO', pedidoId: 'pedido-uuid', title: 'Nuevo pedido asignado', body: 'Tienes un nuevo servicio en curso.' });
        expect(result).toEqual({ ok: true, sent: 1 });
      } finally {
        global.fetch = originalFetch;
      }

      expect(pushRepo.findByUser).toHaveBeenCalledWith('destinatario-uuid');
      expect(sendWebPushMock).toHaveBeenCalledWith(expect.objectContaining({ endpoint: 'https://push.example/subscription' }), expect.stringContaining('pedido-uuid'));
      expect(expoTokensRepo.findByUser).toHaveBeenCalledWith('destinatario-uuid');
      expect(fetchMock).toHaveBeenCalledWith('https://exp.host/--/api/v2/push/send', expect.objectContaining({ method: 'POST' }));
    });

    it('continua con Android cuando falla el envio Web Push', async () => {
      const originalFetch = global.fetch;
      const fetchMock = jest.fn().mockResolvedValue({ ok: true });
      global.fetch = fetchMock as unknown as typeof fetch;
      sendWebPushMock.mockRejectedValue(new Error('web push no disponible'));
      pushRepo.findByUser.mockResolvedValue([{ endpoint: 'https://push.example/subscription', expirationTime: null, p256dh: 'web-p256dh', auth: 'web-auth' }]);
      expoTokensRepo.findByUser.mockResolvedValue([{ token: 'ExponentPushToken[android-token]', platform: 'android' }]);

      try {
        await expect(service.notifyUser('destinatario-uuid', { type: 'PEDIDO_ASIGNADO', pedidoId: 'pedido-uuid' })).resolves.toEqual({ ok: true, sent: 1 });
      } finally {
        global.fetch = originalFetch;
      }

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('notifyDomiciliarioAsignado', () => {
    it('persiste la notificacion con tipo PEDIDO_ASIGNADO', async () => {
      notificationsRepo.saveNotification.mockResolvedValue({ id: 'notif-id' });
      pushRepo.findByUser.mockResolvedValue([]);
      expoTokensRepo.findByUser.mockResolvedValue([]);
      await service.notifyDomiciliarioAsignado({ domiciliarioId: 'domi-uuid', domiciliarioNombre: 'Juan', pedidoId: 'pedido-uuid' });
      expect(notificationsRepo.saveNotification).toHaveBeenCalledWith(expect.objectContaining({ tipo: 'PEDIDO_ASIGNADO', destinatarioId: 'domi-uuid', pedidoId: 'pedido-uuid', datos: expect.objectContaining({ url: '/profile/current-delivery' }) }));
    });
  });

  describe('notifyAdminEstadoCambiado', () => {
    it('persiste la notificacion con tipo PEDIDO_ESTADO_ACTUALIZADO', async () => {
      notificationsRepo.saveNotification.mockResolvedValue({ id: 'notif-id' });
      pushRepo.findByUser.mockResolvedValue([]);
      expoTokensRepo.findByUser.mockResolvedValue([]);
      await service.notifyAdminEstadoCambiado({ adminId: 'admin-uuid', domiciliarioNombre: 'Juan', pedidoId: 'pedido-uuid', estado: 'HECHO' });
      expect(notificationsRepo.saveNotification).toHaveBeenCalledWith(expect.objectContaining({ tipo: 'PEDIDO_ESTADO_ACTUALIZADO', destinatarioId: 'admin-uuid', datos: expect.objectContaining({ url: '/delivery?pedidoId=pedido-uuid' }) }));
    });

    it('no hace nada si adminId es null', async () => {
      await service.notifyAdminEstadoCambiado({ adminId: null, domiciliarioNombre: 'Juan', pedidoId: 'pedido-uuid', estado: 'HECHO' });
      expect(notificationsRepo.saveNotification).not.toHaveBeenCalled();
    });
  });
});
