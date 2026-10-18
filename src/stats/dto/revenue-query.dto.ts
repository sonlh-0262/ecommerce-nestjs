import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

import { VALIDATION_MESSAGES } from '../../common/constants/validation-messages';
import { LangQueryDto } from '../../common/dto/lang-query.dto';
import {
  REVENUE_GROUP_BY,
  REVENUE_GROUPINGS,
  REVENUE_MAX_YEAR,
  REVENUE_MIN_YEAR,
  RevenueGroupBy,
} from '../stats.constants';

export class RevenueQueryDto extends LangQueryDto {
  @ApiProperty({
    enum: REVENUE_GROUP_BY,
    description:
      `\`month\`: the ${REVENUE_GROUPINGS.month.periods} months of \`year\`. ` +
      `\`year\`: the ${REVENUE_GROUPINGS.year.periods} years ending with \`year\`.`,
  })
  @IsIn(REVENUE_GROUP_BY, VALIDATION_MESSAGES.isIn)
  groupBy: RevenueGroupBy;

  @ApiPropertyOptional({
    description: 'Defaults to the current year in the shop time zone.',
    minimum: REVENUE_MIN_YEAR,
    maximum: REVENUE_MAX_YEAR,
    example: 2026,
  })
  @IsOptional()
  @IsInt(VALIDATION_MESSAGES.isInt)
  @Min(REVENUE_MIN_YEAR, VALIDATION_MESSAGES.min)
  @Max(REVENUE_MAX_YEAR, VALIDATION_MESSAGES.max)
  year?: number;
}
