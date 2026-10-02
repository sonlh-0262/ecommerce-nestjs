import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { I18nLang } from 'nestjs-i18n';

import { AppService } from './app.service';
import { HEALTH_ROUTE } from './common/constants/routes';
import { LangQueryDto } from './common/dto/lang-query.dto';
import { HealthResponseDto } from './dto/health-response.dto';

@ApiTags('App')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /**
   * Served outside the versioned prefix, so the Docker health check and any
   * load balancer keep one stable URL across API versions.
   *
   * The query DTO is bound but not read: `@I18nLang()` has already resolved
   * the language by the time the handler runs. It is declared because the
   * global pipe runs with `forbidNonWhitelisted`, which would otherwise reject
   * `?lang=vi` as an unknown parameter - and because it puts `lang` in the
   * OpenAPI document for this route.
   */
  @Get(HEALTH_ROUTE)
  @ApiOperation({
    summary: 'Health check',
    description: 'Liveness probe. The message is localised.',
  })
  @ApiOkResponse({ type: HealthResponseDto })
  @ApiBadRequestResponse({
    description: 'An unknown query parameter was sent.',
  })
  getHealth(
    @I18nLang() lang: string,
    @Query() _query: LangQueryDto,
  ): HealthResponseDto {
    return this.appService.getHealth(lang);
  }
}
