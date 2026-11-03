import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

import { VALIDATION_MESSAGES } from '../../common/constants/validation-messages';
import { MAX_LIMIT, MIN_LIMIT } from '../../common/constants/pagination';
import { LangQueryDto } from '../../common/dto/lang-query.dto';
import { IsIsoInstant } from '../../common/validators/is-iso-instant.validator';
import { MESSAGES_DEFAULT_LIMIT } from '../chat.constants';

export class MessagesQueryDto extends LangQueryDto {
  @ApiPropertyOptional({
    description:
      'Cursor: only messages sent strictly before this instant (ISO 8601). ' +
      'Pass the `createdAt` of the oldest message already shown.',
    example: '2026-10-29T08:30:00.000Z',
  })
  @IsOptional()
  @IsIsoInstant()
  before?: string;

  @ApiPropertyOptional({
    description: `How many messages to return (max ${MAX_LIMIT}).`,
    minimum: MIN_LIMIT,
    maximum: MAX_LIMIT,
    default: MESSAGES_DEFAULT_LIMIT,
  })
  @IsInt(VALIDATION_MESSAGES.isInt)
  @Min(MIN_LIMIT, VALIDATION_MESSAGES.min)
  @Max(MAX_LIMIT, VALIDATION_MESSAGES.max)
  limit: number = MESSAGES_DEFAULT_LIMIT;
}
