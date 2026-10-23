import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import Redis from 'ioredis';

import { errorMessage } from '../common/helpers/error-message';
import { withTimeout } from '../common/helpers/with-timeout';
import {
  LOCK_COMMAND_TIMEOUT_MS,
  LOCK_KEY_PREFIX,
  REDIS_CLIENT,
  RELEASE_LOCK_SCRIPT,
} from './redis.constants';

@Injectable()
export class RedisLockService {
  private readonly logger = new Logger(RedisLockService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  claim(name: string, ttlSeconds: number): Promise<boolean> {
    return this.acquire(keyOf(name), randomUUID(), ttlSeconds);
  }

  async runExclusive(
    name: string,
    ttlSeconds: number,
    task: () => Promise<unknown>,
  ): Promise<boolean> {
    const key = keyOf(name);
    const token = randomUUID();

    try {
      if (!(await this.acquire(key, token, ttlSeconds))) {
        this.logger.log(`Skipped ${key}: another run holds the lock`);

        return false;
      }
    } catch (error) {
      this.logger.warn(
        `Skipped ${key}: lock unavailable (${errorMessage(error)})`,
      );

      return false;
    }

    try {
      await task();

      return true;
    } finally {
      await this.release(key, token);
    }
  }

  private async acquire(
    key: string,
    token: string,
    ttlSeconds: number,
  ): Promise<boolean> {
    const reply = await withTimeout(
      this.redis.set(key, token, 'EX', ttlSeconds, 'NX'),
      LOCK_COMMAND_TIMEOUT_MS,
    );

    return reply !== null;
  }

  private async release(key: string, token: string): Promise<void> {
    try {
      await withTimeout(
        this.redis.eval(RELEASE_LOCK_SCRIPT, 1, key, token),
        LOCK_COMMAND_TIMEOUT_MS,
      );
    } catch (error) {
      this.logger.warn(
        `Could not release ${key}, it expires on its own: ${errorMessage(error)}`,
      );
    }
  }
}

function keyOf(name: string): string {
  return `${LOCK_KEY_PREFIX}${name}`;
}
