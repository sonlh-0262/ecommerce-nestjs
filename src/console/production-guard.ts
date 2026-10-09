import { ConfigService } from '@nestjs/config';

import { APP_CONFIG_KEY, AppConfig } from '../config/configuration';
import { Environment } from '../config/env.validation';

export function isProduction(configService: ConfigService): boolean {
  const { nodeEnv } = configService.getOrThrow<AppConfig>(APP_CONFIG_KEY);

  return nodeEnv === String(Environment.Production);
}
