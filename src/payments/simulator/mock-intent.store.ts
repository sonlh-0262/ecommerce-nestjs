import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';

import { withTimeout } from '../../common/helpers/with-timeout';
import { REDIS_CLIENT } from '../../redis/redis.constants';
import { MockIntent } from './interfaces/mock-intent.interface';
import {
  MOCK_INTENT_KEY_PREFIX,
  MOCK_INTENT_TTL_SECONDS,
  MOCK_STORE_TIMEOUT_MS,
} from './payment-simulator.constants';

@Injectable()
export class MockIntentStore {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async find(id: string): Promise<MockIntent | null> {
    const raw = await withTimeout(
      this.redis.get(keyOf(id)),
      MOCK_STORE_TIMEOUT_MS,
    );

    return raw ? (JSON.parse(raw) as MockIntent) : null;
  }

  async save(intent: MockIntent): Promise<MockIntent> {
    await withTimeout(
      this.redis.set(
        keyOf(intent.id),
        JSON.stringify(intent),
        'EX',
        MOCK_INTENT_TTL_SECONDS,
      ),
      MOCK_STORE_TIMEOUT_MS,
    );

    return intent;
  }
}

function keyOf(id: string): string {
  return `${MOCK_INTENT_KEY_PREFIX}${id}`;
}
