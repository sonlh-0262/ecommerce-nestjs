import { registerAs } from '@nestjs/config';

import { DEFAULT_LANGUAGE } from '../common/constants/languages';

export interface AppConfig {
  nodeEnv: string;
  name: string;
  port: number;
  apiPrefix: string;
  fallbackLanguage: string;
  swagger: {
    enabled: boolean;
    path: string;
  };
}

export const APP_CONFIG_KEY = 'app';

/**
 * Centralised, typed application configuration.
 * Injected with `ConfigService#get<AppConfig>('app')`.
 */
export default registerAs(APP_CONFIG_KEY, (): AppConfig => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  name: process.env.APP_NAME ?? 'E-commerce API',
  port: parseInt(process.env.PORT ?? '3000', 10),
  apiPrefix: process.env.API_PREFIX ?? '',
  fallbackLanguage: process.env.FALLBACK_LANGUAGE ?? DEFAULT_LANGUAGE,
  swagger: {
    enabled: process.env.SWAGGER_ENABLED
      ? process.env.SWAGGER_ENABLED === 'true'
      : process.env.NODE_ENV !== 'production',
    path: process.env.SWAGGER_PATH ?? 'api',
  },
}));
