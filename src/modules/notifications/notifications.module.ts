import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PushSubscriptionEntity } from './entities/push-subscription.entity';
import { NotificationEntity } from './entities/notification.entity';
import { ExpoTokenEntity } from './entities/expo-token.entity';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { PushSubscriptionsRepository } from './repositories/push-subscriptions.repository';
import { NotificationsRepository } from './repositories/notifications.repository';
import { ExpoTokensRepository } from './repositories/expo-tokens.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PushSubscriptionEntity,
      NotificationEntity,
      ExpoTokenEntity,
    ]),
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    PushSubscriptionsRepository,
    NotificationsRepository,
    ExpoTokensRepository,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
