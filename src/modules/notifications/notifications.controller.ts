import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';
import { CreatePushSubscriptionDto } from './dtos/create-push-subscription.dto';
import { UnsubscribeDto } from './dtos/unsubscribe.dto';
import { RegisterExpoTokenDto } from './dtos/register-expo-token.dto';

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  // ─── Web Push ──────────────────────────────────────────────────────────────

  @Post('subscribe')
  subscribe(@CurrentUser('id') userId: string, @Body() dto: CreatePushSubscriptionDto) {
    return this.notifications.subscribe(userId, dto);
  }

  @Post('unsubscribe')
  unsubscribe(@CurrentUser('id') userId: string, @Body() dto: UnsubscribeDto) {
    return this.notifications.unsubscribe(userId, dto.endpoint);
  }

  /**
   * GET /notifications/public-key
   * El frontend (web) lo llama para obtener la clave pública VAPID
   * antes de suscribirse a Web Push.
   */
  @Get('public-key')
  getPublicKey() {
    return this.notifications.getWebPushPublicKey();
  }

  // ─── Expo Push ─────────────────────────────────────────────────────────────

  /**
   * POST /notifications/register-token
   * La aplicacion Android lo llama tras obtener el token Expo.
   * Body: { token: string, platform: 'android', provider: 'EXPO' }
   */
  @Post('register-token')
  registerToken(
    @CurrentUser('id') userId: string,
    @Body() dto: RegisterExpoTokenDto,
  ) {
    return this.notifications.registerExpoToken(userId, dto.token, dto.platform);
  }

  // ─── Notificaciones persistidas ────────────────────────────────────────────

  /**
   * PATCH /notifications/:id/read
   * Marca una notificación como leída por el usuario actual.
   */
  @Patch(':id/read')
  markAsRead(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.notifications.markAsRead(id, userId);
  }

  // ─── Test ──────────────────────────────────────────────────────────────────

  @Post('test')
  test(@CurrentUser('id') userId: string) {
    return this.notifications.notifyUser(userId, {
      title: 'Notificación de prueba',
      body: 'Si ves esto, quedó OK ✅',
      url: '/profile-delivery/current-delivery',
    });
  }
}
