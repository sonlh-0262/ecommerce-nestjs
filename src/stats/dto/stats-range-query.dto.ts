import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';

import { LangQueryDto } from '../../common/dto/lang-query.dto';
import { IsIsoInstant } from '../../common/validators/is-iso-instant.validator';
import { STATS_DEFAULT_RANGE_MONTHS } from '../stats.constants';

export class StatsRangeQueryDto extends LangQueryDto {
  @ApiPropertyOptional({
    description:
      `Start of the range, included (ISO 8601). Defaults to ` +
      `${STATS_DEFAULT_RANGE_MONTHS} months before \`to\`.`,
    example: '2026-01-01T00:00:00+07:00',
  })
  @IsOptional()
  @IsIsoInstant()
  from?: string;

  @ApiPropertyOptional({
    description:
      'End of the range, excluded (ISO 8601). Defaults to now. A bare date ' +
      'means midnight UTC; a time needs its offset.',
    example: '2027-01-01T00:00:00+07:00',
  })
  @IsOptional()
  @IsIsoInstant()
  to?: string;
}
