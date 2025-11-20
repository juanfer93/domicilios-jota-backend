import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PushSubscriptionEntity } from './entities/push-subscription.entity';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { PushSubscriptionsRepository } from './repositories/push-subscriptions.repository';

@Module({
  imports: [TypeOrmModule.forFeature([PushSubscriptionEntity])],
  controllers: [NotificationsController],
  providers: [NotificationsService, PushSubscriptionsRepository],
  exports: [NotificationsService],
})
export class NotificationsModule {}
