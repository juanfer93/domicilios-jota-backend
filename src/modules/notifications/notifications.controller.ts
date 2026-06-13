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
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreatePushSubscriptionDto } from './dtos/create-push-subscription.dto';
import { RegisterExpoTokenDto } from './dtos/register-expo-token.dto';
import { UnsubscribeDto } from './dtos/unsubscribe.dto';
import { NotificationsService } from './notifications.service';

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Post('subscribe')
  subscribe(
    @CurrentUser('id') userId: string,
    @Body() dto: CreatePushSubscriptionDto,
  ) {
    return this.notifications.subscribe(userId, dto);
  }

  @Post('unsubscribe')
  unsubscribe(@CurrentUser('id') userId: string, @Body() dto: UnsubscribeDto) {
    return this.notifications.unsubscribe(userId, dto.endpoint);
  }

  @Get('public-key')
  getPublicKey() {
    return this.notifications.getWebPushPublicKey();
  }

  @Post('register-token')
  registerToken(
    @CurrentUser('id') userId: string,
    @Body() dto: RegisterExpoTokenDto,
  ) {
    return this.notifications.registerExpoToken(userId, dto.token, dto.platform);
  }

  @Patch(':id/read')
  markAsRead(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.notifications.markAsRead(id, userId);
  }
}
