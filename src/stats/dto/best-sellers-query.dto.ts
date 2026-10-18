import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';

import { VALIDATION_MESSAGES } from '../../common/constants/validation-messages';
import {
  BEST_SELLERS_DEFAULT_LIMIT,
  BEST_SELLERS_MAX_LIMIT,
  BEST_SELLERS_MIN_LIMIT,
} from '../stats.constants';
import { StatsRangeQueryDto } from './stats-range-query.dto';

export class BestSellersQueryDto extends StatsRangeQueryDto {
  @ApiPropertyOptional({
    description: 'How many products to rank.',
    minimum: BEST_SELLERS_MIN_LIMIT,
    maximum: BEST_SELLERS_MAX_LIMIT,
    default: BEST_SELLERS_DEFAULT_LIMIT,
  })
  @IsInt(VALIDATION_MESSAGES.isInt)
  @Min(BEST_SELLERS_MIN_LIMIT, VALIDATION_MESSAGES.min)
  @Max(BEST_SELLERS_MAX_LIMIT, VALIDATION_MESSAGES.max)
  limit: number = BEST_SELLERS_DEFAULT_LIMIT;
}
