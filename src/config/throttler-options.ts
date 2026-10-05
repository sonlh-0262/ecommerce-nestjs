import { ExecutionContext } from '@nestjs/common';
import { seconds, ThrottlerModuleOptions } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import Redis from 'ioredis';
import { I18nContext, I18nService } from 'nestjs-i18n';

import { FailOpenThrottlerStorage } from '../common/throttling/fail-open-throttler.storage';
import { DEFAULT_THROTTLER_NAME } from '../common/throttling/throttling.constants';
import { ThrottleConfig } from './throttle.config';

const TOO_MANY_REQUESTS_KEY = 'common.TOO_MANY_REQUESTS';

export function buildThrottlerOptions(
  config: ThrottleConfig,
  redis: Redis,
  i18n: I18nService,
): ThrottlerModuleOptions {
  return {
    throttlers: [
      {
        name: DEFAULT_THROTTLER_NAME,
        ttl: seconds(config.ttlSeconds),
        limit: config.limit,
      },
    ],
    storage: new FailOpenThrottlerStorage(
      new ThrottlerStorageRedisService(redis),
    ),
    errorMessage: (context: ExecutionContext) =>
      I18nContext.current(context)?.t(TOO_MANY_REQUESTS_KEY) ??
      i18n.t(TOO_MANY_REQUESTS_KEY),
  };
}
