import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { I18nService } from 'nestjs-i18n';

import { DEFAULT_LANGUAGE } from './common/constants/languages';
import { APP_CONFIG_KEY, AppConfig } from './config/configuration';
import { HealthResponseDto } from './dto/health-response.dto';

@Injectable()
export class AppService {
  constructor(
    private readonly i18n: I18nService,
    private readonly configService: ConfigService,
  ) {}

  getHealth(lang: string): HealthResponseDto {
    const language = this.effectiveLanguage(lang);

    return {
      status: 'ok',
      message: this.i18n.t('common.health_ok', { lang: language }),
      uptime: Number(process.uptime().toFixed(2)),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * The language the response will actually be rendered in.
   *
   * A request may ask for a language this API has no catalogue for; the body
   * then comes back in the fallback language, and the resolved name has to say
   * so rather than echo what was asked for.
   */
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
