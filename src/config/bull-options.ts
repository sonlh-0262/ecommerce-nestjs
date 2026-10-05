import { QueueOptions } from 'bullmq';

import { RedisConfig } from './redis.config';

const QUEUE_KEY_SEGMENT = 'bull';

export function buildBullOptions(
  config: RedisConfig,
): Pick<QueueOptions, 'connection' | 'prefix'> {
  return {
    connection: {
      host: config.host,
      port: config.port,
      password: config.password,
      db: config.db,
      maxRetriesPerRequest: null,
    },
    prefix: `${config.keyPrefix}${QUEUE_KEY_SEGMENT}`,
  };
}
