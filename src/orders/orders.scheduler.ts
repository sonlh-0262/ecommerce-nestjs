import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import {
  SCHEDULED_JOB_LOCK_TTL_SECONDS,
  SCHEDULED_JOBS,
} from '../common/constants/scheduled-jobs';
import { RedisLockService } from '../redis/redis-lock.service';
import { OrderExpiryService } from './order-expiry.service';

const JOB = SCHEDULED_JOBS.OrdersAutoCancel;

@Injectable()
export class OrdersScheduler {
  constructor(
    private readonly lock: RedisLockService,
    private readonly expiry: OrderExpiryService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR, { name: JOB })
  cancelExpiredOrders(): Promise<boolean> {
    return this.lock.runExclusive(
      JOB,
      SCHEDULED_JOB_LOCK_TTL_SECONDS[JOB],
      () => this.expiry.cancelExpired(new Date()),
    );
  }
}
