import Redis from 'ioredis';

import { RedisConfig } from '../../src/config/redis.config';
import { TEST_REDIS_KEY_PREFIX_MARKER } from './test.constants';

/** Number of keys `SCAN` is asked to examine per round trip. */
const SCAN_COUNT = 100;

/** The prefix is what is checked because it is what bounds `clearRedis()`. */
export function assertTestRedis(config: RedisConfig): void {
  if (config.keyPrefix.includes(TEST_REDIS_KEY_PREFIX_MARKER)) {
    return;
  }

  throw new Error(
    `Refusing to run the e2e suite with the Redis key prefix ` +
      `"${config.keyPrefix}": the suite deletes every key under that prefix ` +
      `between test cases, so REDIS_KEY_PREFIX must contain ` +
      `"${TEST_REDIS_KEY_PREFIX_MARKER}". Check .env.test.`,
  );
}

/**
 * Deletes every key this app owns, so state written by one case cannot leak
 * into the next.
 *
 * By prefix rather than `FLUSHDB`, which would empty the whole logical
 * database - wider than what `assertTestRedis()` checks.
 *
 * The prefix is stripped on the way out because ioredis only prefixes the
 * arguments a command declares as keys: `SCAN`'s `MATCH` pattern is not one,
 * so the keys come back fully qualified, while `UNLINK`'s arguments are, and
 * would otherwise be prefixed twice.
 */
export async function clearRedis(
  redis: Redis,
  config: RedisConfig,
): Promise<void> {
  const pattern = `${config.keyPrefix}*`;
  let cursor = '0';

  do {
    const [next, keys] = await redis.scan(
      cursor,
      'MATCH',
      pattern,
      'COUNT',
      SCAN_COUNT,
    );

    cursor = next;

    if (keys.length > 0) {
      await redis.unlink(
        ...keys.map((key) => key.slice(config.keyPrefix.length)),
      );
    }
  } while (cursor !== '0');
}
