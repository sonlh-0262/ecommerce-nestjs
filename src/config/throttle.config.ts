import { registerAs } from '@nestjs/config';

import {
  DEFAULT_THROTTLE_LIMIT,
  DEFAULT_THROTTLE_TTL_SECONDS,
} from './config.constants';

export interface ThrottleConfig {
  ttlSeconds: number;
  limit: number;
}

export const THROTTLE_CONFIG_KEY = 'throttle';

export default registerAs(THROTTLE_CONFIG_KEY, (): ThrottleConfig => ({
  ttlSeconds: parseInt(
    process.env.THROTTLE_TTL ?? String(DEFAULT_THROTTLE_TTL_SECONDS),
    10,
  ),
  limit: parseInt(
    process.env.THROTTLE_LIMIT ?? String(DEFAULT_THROTTLE_LIMIT),
    10,
  ),
}));
