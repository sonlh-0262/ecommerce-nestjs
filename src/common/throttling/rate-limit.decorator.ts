import { Throttle, ThrottlerOptions } from '@nestjs/throttler';

import { DEFAULT_THROTTLER_NAME } from './throttling.constants';

export type RouteRateLimit = Pick<
  ThrottlerOptions,
  'limit' | 'ttl' | 'getTracker'
>;

export const RateLimit = (options: RouteRateLimit) =>
  Throttle({ [DEFAULT_THROTTLER_NAME]: options });
