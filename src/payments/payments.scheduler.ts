import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import {
  SCHEDULED_JOB_LOCK_TTL_SECONDS,
  SCHEDULED_JOBS,
} from '../common/constants/scheduled-jobs';
import { RedisLockService } from '../redis/redis-lock.service';
import { PaymentRefundsService } from './payment-refunds.service';

const JOB = SCHEDULED_JOBS.PaymentRefundsRetry;

@Injectable()
export class PaymentsScheduler {
  constructor(
    private readonly lock: RedisLockService,
    private readonly refunds: PaymentRefundsService,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES, { name: JOB })
  retryStaleRefunds(): Promise<boolean> {
    return this.lock.runExclusive(
      JOB,
      SCHEDULED_JOB_LOCK_TTL_SECONDS[JOB],
      () => this.refunds.retryStale(new Date()),
    );
  }
}
