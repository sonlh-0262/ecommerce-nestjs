import { Inject, Injectable } from '@nestjs/common';
import {
  HealthIndicatorResult,
  HealthIndicatorService,
} from '@nestjs/terminus';
import Redis from 'ioredis';

import { withTimeout } from '../common/helpers/with-timeout';
import { REDIS_CLIENT } from '../redis/redis.constants';
import { HEALTH_CHECK_TIMEOUT_MS } from './health.constants';

@Injectable()
export class RedisHealthIndicator {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly healthIndicatorService: HealthIndicatorService,
  ) {}

  async pingCheck<Key extends string>(
    key: Key,
    timeoutMs = HEALTH_CHECK_TIMEOUT_MS,
  ): Promise<HealthIndicatorResult<Key>> {
    const indicator = this.healthIndicatorService.check(key);

    try {
      await withTimeout(this.redis.ping(), timeoutMs);

      return indicator.up();
    } catch {
      return indicator.down();
    }
  }
}
