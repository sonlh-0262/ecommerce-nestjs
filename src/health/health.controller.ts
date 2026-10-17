import { Controller, Get, HttpStatus, Query, UseFilters } from '@nestjs/common';
import {
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { I18nLang } from 'nestjs-i18n';

import { HEALTH_ROUTE } from '../common/constants/routes';
import { ApiErrorResponse } from '../common/decorators/api-error-response.decorator';
import { Public } from '../common/decorators/public.decorator';
import { LangQueryDto } from '../common/dto/lang-query.dto';
import {
  HealthComponentDto,
  HealthResponseDto,
} from './dto/health-response.dto';
import { HealthService } from './health.service';
import { HealthUnavailableFilter } from './health-unavailable.filter';

@ApiTags('Health')
@ApiExtraModels(HealthComponentDto)
@Controller()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get(HEALTH_ROUTE)
  @Public()
  @SkipThrottle()
  @UseFilters(HealthUnavailableFilter)
  @ApiOperation({
    summary: 'Health check',
    description:
      'Readiness probe: pings PostgreSQL and Redis. 200 when both answer, ' +
      '503 when either does not. The message is localised.',
  })
  @ApiOkResponse({ type: HealthResponseDto })
  @ApiErrorResponse(
    HttpStatus.SERVICE_UNAVAILABLE,
    'A component is down; `details` says which.',
    HealthResponseDto,
  )
  @ApiErrorResponse(
    HttpStatus.BAD_REQUEST,
    'An unknown query parameter was sent.',
  )
  getHealth(
    @I18nLang() lang: string,
    @Query() _query: LangQueryDto,
  ): Promise<HealthResponseDto> {
    return this.healthService.check(lang);
  }
}
