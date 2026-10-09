import { Inject, Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';

import {
  cacheKey,
  CacheResource,
  CacheVariant,
  generationKey,
} from '../common/constants/cache-keys';
import { withTimeout } from '../common/helpers/with-timeout';
import { REDIS_CLIENT } from '../redis/redis.constants';
import { CACHE_COMMAND_TIMEOUT_MS } from './cache.constants';

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async getOrSet<T>(
    resource: CacheResource,
    variant: CacheVariant,
    ttlSeconds: number,
    factory: () => Promise<T>,
  ): Promise<T> {
    const generation = await this.generationOf(resource);

    if (generation === null) {
      return factory();
    }

    const key = cacheKey(resource, generation, variant);
    const cached = await this.get<T>(key);

    if (cached !== null) {
      return cached;
    }

    const value = await factory();

    await this.set(key, value, ttlSeconds);

    return value;
  }

  async invalidate(...resources: CacheResource[]): Promise<void> {
    for (const resource of resources) {
      try {
        await this.command(this.redis.incr(generationKey(resource)));
      } catch (error) {
        this.logger.warn(
          `Cache invalidation failed for ${resource}: ${messageOf(error)}`,
        );
      }
    }
  }

  private async generationOf(resource: CacheResource): Promise<number | null> {
    try {
      return Number(
        (await this.command(this.redis.get(generationKey(resource)))) ?? 0,
      );
    } catch (error) {
      this.logger.warn(
        `Cache generation unreadable for ${resource}: ${messageOf(error)}`,
      );

      return null;
    }
  }

  private async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.command(this.redis.get(key));

      return raw === null ? null : (JSON.parse(raw) as T);
    } catch (error) {
      this.logger.warn(`Cache read failed for ${key}: ${messageOf(error)}`);

      return null;
    }
  }

  private async set<T>(
    key: string,
    value: T,
    ttlSeconds: number,
  ): Promise<void> {
    try {
      await this.command(
        this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds),
      );
    } catch (error) {
      this.logger.warn(`Cache write failed for ${key}: ${messageOf(error)}`);
    }
  }

  private command<T>(pending: Promise<T>): Promise<T> {
    return withTimeout(pending, CACHE_COMMAND_TIMEOUT_MS);
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
