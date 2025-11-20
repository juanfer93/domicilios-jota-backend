import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';
import { CreatePushSubscriptionDto } from './dtos/create-push-subscription.dto';
import { UnsubscribeDto } from './dtos/unsubscribe.dto';

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Post('subscribe')
  subscribe(@CurrentUser('id') userId: string, @Body() dto: CreatePushSubscriptionDto) {
    return this.notifications.subscribe(userId, dto);
  }

  @Post('unsubscribe')
  unsubscribe(@CurrentUser('id') userId: string, @Body() dto: UnsubscribeDto) {
    return this.notifications.unsubscribe(userId, dto.endpoint);
  }

  @Post('test')
  test(@CurrentUser('id') userId: string) {
    return this.notifications.notifyUser(userId, {
      title: 'Notificación de prueba',
      body: 'Si ves esto, quedó OK ✅',
      url: '/profile-delivery/current-delivery',
    });
  }
}
