import { NotFoundException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsRepository } from './repositories/notifications.repository';
import { ExpoTokensRepository } from './repositories/expo-tokens.repository';
import { PushSubscriptionsRepository } from './repositories/push-subscriptions.repository';
import { ConfigService } from '@nestjs/config';
import { NotificationEntity } from './entities/notification.entity';

const makeConfig = (overrides: Record<string, string> = {}) => ({
  get: jest.fn((key: string) => overrides[key] ?? undefined),
});

const makePushRepo = () => ({
  upsertForUser: jest.fn(),
  deleteByEndpointForUser: jest.fn(),
  findByUser: jest.fn().mockResolvedValue([]),
  delete: jest.fn(),
});

const makeNotificationsRepo = () => ({
  saveNotification: jest.fn(),
  markAsRead: jest.fn(),
  findByDestinatario: jest.fn(),
});

const makeExpoTokensRepo = () => ({
  upsertForUser: jest.fn(),
  findByUser: jest.fn().mockResolvedValue([]),
});

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

    service = new NotificationsService(
      makeConfig() as unknown as ConfigService,
      pushRepo as unknown as PushSubscriptionsRepository,
      notificationsRepo as unknown as NotificationsRepository,
      expoTokensRepo as unknown as ExpoTokensRepository,
    );
  });

  // ── registerExpoToken ────────────────────────────────────────────────────

  describe('registerExpoToken', () => {
    it('guarda el token Expo para el usuario', async () => {
      expoTokensRepo.upsertForUser.mockResolvedValue({ id: 'token-id' });

      const result = await service.registerExpoToken(
        'user-uuid',
        'ExponentPushToken[xxxx]',
        'android',
      );

      expect(expoTokensRepo.upsertForUser).toHaveBeenCalledWith(
        'user-uuid',
        'ExponentPushToken[xxxx]',
        'android',
      );
      expect(result).toEqual({ ok: true });
    });
  });

  // ── getWebPushPublicKey ──────────────────────────────────────────────────

  describe('getWebPushPublicKey', () => {
    it('retorna la clave pública VAPID desde la config', () => {
      const svc = new NotificationsService(
        makeConfig({ WEB_PUSH_PUBLIC_KEY: 'mi-clave-publica' }) as unknown as ConfigService,
        pushRepo as unknown as PushSubscriptionsRepository,
        notificationsRepo as unknown as NotificationsRepository,
        expoTokensRepo as unknown as ExpoTokensRepository,
      );

      const result = svc.getWebPushPublicKey();
      expect(result).toEqual({ publicKey: 'mi-clave-publica' });
    });

    it('retorna string vacío si no hay clave configurada', () => {
      const result = service.getWebPushPublicKey();
      expect(result).toEqual({ publicKey: '' });
    });
  });

  // ── markAsRead ───────────────────────────────────────────────────────────

  describe('markAsRead', () => {
    it('marca la notificación como leída y la retorna', async () => {
      const notification: Partial<NotificationEntity> = {
        id: 'notif-uuid',
        destinatarioId: 'user-uuid',
        readAt: new Date(),
      };
      notificationsRepo.markAsRead.mockResolvedValue(notification);

      const result = await service.markAsRead('notif-uuid', 'user-uuid');

      expect(notificationsRepo.markAsRead).toHaveBeenCalledWith('notif-uuid', 'user-uuid');
      expect(result).toBe(notification);
    });

    it('lanza NotFoundException si la notificación no existe o no pertenece al usuario', async () => {
      notificationsRepo.markAsRead.mockResolvedValue(null);

      await expect(
        service.markAsRead('no-existe', 'user-uuid'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── notifyDomiciliarioAsignado ───────────────────────────────────────────

  describe('notifyUser para Android', () => {
    it('envia a Expo el canal orders y el payload persistido', async () => {
      const originalFetch = global.fetch;
      const fetchMock = jest.fn().mockResolvedValue({ ok: true });
      global.fetch = fetchMock as unknown as typeof fetch;

      notificationsRepo.saveNotification.mockResolvedValue({
        id: 'notif-id',
        createdAt: new Date('2026-06-12T18:30:00.000Z'),
      });
      expoTokensRepo.findByUser.mockResolvedValue([
        { token: 'ExponentPushToken[android-token]', platform: 'android' },
      ]);

      try {
        await service.notifyUser(
          'user-uuid',
          { type: 'PEDIDO_ASIGNADO', pedidoId: 'pedido-uuid' },
          {
            tipo: 'PEDIDO_ASIGNADO',
            titulo: 'Nuevo pedido asignado',
            cuerpo: 'Tienes un nuevo servicio en curso.',
            pedidoId: 'pedido-uuid',
          },
        );
      } finally {
        global.fetch = originalFetch;
      }

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const request = fetchMock.mock.calls[0][1] as RequestInit;
      expect(JSON.parse(request.body as string)).toEqual([
        expect.objectContaining({
          to: 'ExponentPushToken[android-token]',
          channelId: 'orders',
          title: 'Nuevo pedido asignado',
          body: 'Tienes un nuevo servicio en curso.',
          data: expect.objectContaining({
            notificationId: 'notif-id',
            pedidoId: 'pedido-uuid',
            createdAt: '2026-06-12T18:30:00.000Z',
          }),
        }),
      ]);
    });
  });

  describe('notifyDomiciliarioAsignado', () => {
    it('persiste la notificación con tipo PEDIDO_ASIGNADO', async () => {
      const notif = { id: 'notif-id' };
      notificationsRepo.saveNotification.mockResolvedValue(notif);
      pushRepo.findByUser.mockResolvedValue([]);
      expoTokensRepo.findByUser.mockResolvedValue([]);

      await service.notifyDomiciliarioAsignado({
        domiciliarioId: 'domi-uuid',
        domiciliarioNombre: 'Juan',
        pedidoId: 'pedido-uuid',
      });

      expect(notificationsRepo.saveNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          tipo: 'PEDIDO_ASIGNADO',
          destinatarioId: 'domi-uuid',
          pedidoId: 'pedido-uuid',
        }),
      );
    });
  });

  // ── notifyAdminEstadoCambiado ────────────────────────────────────────────

  describe('notifyAdminEstadoCambiado', () => {
    it('persiste la notificación con tipo PEDIDO_ESTADO_ACTUALIZADO', async () => {
      const notif = { id: 'notif-id' };
      notificationsRepo.saveNotification.mockResolvedValue(notif);
      pushRepo.findByUser.mockResolvedValue([]);
      expoTokensRepo.findByUser.mockResolvedValue([]);

      await service.notifyAdminEstadoCambiado({
        adminId: 'admin-uuid',
        domiciliarioNombre: 'Juan',
        pedidoId: 'pedido-uuid',
        estado: 'HECHO',
      });

      expect(notificationsRepo.saveNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          tipo: 'PEDIDO_ESTADO_ACTUALIZADO',
          destinatarioId: 'admin-uuid',
        }),
      );
    });

    it('no hace nada si adminId es null', async () => {
      await service.notifyAdminEstadoCambiado({
        adminId: null,
        domiciliarioNombre: 'Juan',
        pedidoId: 'pedido-uuid',
        estado: 'HECHO',
      });

      expect(notificationsRepo.saveNotification).not.toHaveBeenCalled();
    });
  });
});
