import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  HealthCheckResult,
  HealthCheckService,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { I18nService } from 'nestjs-i18n';

import { DEFAULT_LANGUAGE } from '../common/constants/languages';
import { APP_CONFIG_KEY, AppConfig } from '../config/configuration';
import { HealthResponseDto, toHealthResponse } from './dto/health-response.dto';
import {
  DATABASE_HEALTH_KEY,
  HEALTH_CHECK_TIMEOUT_MS,
  REDIS_HEALTH_KEY,
} from './health.constants';
import { HealthUnavailableException } from './health-unavailable.exception';
import { RedisHealthIndicator } from './redis.health';

@Injectable()
export class HealthService {
  constructor(
    private readonly healthCheckService: HealthCheckService,
    private readonly database: TypeOrmHealthIndicator,
    private readonly redis: RedisHealthIndicator,
    private readonly i18n: I18nService,
    private readonly configService: ConfigService,
  ) {}

  async check(lang: string): Promise<HealthResponseDto> {
    const result = await this.runChecks();
    const healthy = result.status === 'ok';
    const health = toHealthResponse(
      result,
      this.i18n.t(healthy ? 'common.health_ok' : 'common.health_unavailable', {
        lang: this.effectiveLanguage(lang),
      }),
    );

    if (!healthy) {
      throw new HealthUnavailableException(health);
    }

    return health;
  }

  private async runChecks(): Promise<HealthCheckResult> {
    try {
      return await this.healthCheckService.check([
        () =>
          this.database.pingCheck(DATABASE_HEALTH_KEY, {
            timeout: HEALTH_CHECK_TIMEOUT_MS,
          }),
        () => this.redis.pingCheck(REDIS_HEALTH_KEY),
      ]);
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        return error.getResponse() as HealthCheckResult;
      }

      throw error;
    }
  }

  private effectiveLanguage(lang: string): string {
    const resolved = this.i18n.resolveLanguage(lang);

    if (this.i18n.getSupportedLanguages().includes(resolved)) {
      return resolved;
    }

    return (
      this.configService.get<AppConfig>(APP_CONFIG_KEY)?.fallbackLanguage ??
      DEFAULT_LANGUAGE
    );
  }
}
