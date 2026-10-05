import { Logger } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
import { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface';

import { withTimeout } from '../helpers/with-timeout';
import { THROTTLER_STORAGE_TIMEOUT_MS } from './throttling.constants';

const UNCOUNTED: ThrottlerStorageRecord = {
  totalHits: 0,
  timeToExpire: 0,
  isBlocked: false,
  timeToBlockExpire: 0,
};

export class FailOpenThrottlerStorage implements ThrottlerStorage {
  private readonly logger = new Logger(FailOpenThrottlerStorage.name);

  constructor(
    private readonly storage: ThrottlerStorage,
    private readonly timeoutMs = THROTTLER_STORAGE_TIMEOUT_MS,
  ) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    try {
      return await withTimeout(
        this.storage.increment(key, ttl, limit, blockDuration, throttlerName),
        this.timeoutMs,
      );
    } catch (error) {
      this.logger.warn(
        `Rate limit not applied, counter unavailable: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      return { ...UNCOUNTED };
    }
  }
}
