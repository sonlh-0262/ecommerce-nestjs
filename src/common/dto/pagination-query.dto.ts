import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';

import {
  DEFAULT_LIMIT,
  DEFAULT_OFFSET,
  MAX_LIMIT,
  MIN_LIMIT,
  MIN_OFFSET,
} from '../constants/pagination';
import { LangQueryDto } from './lang-query.dto';

export class PaginationQueryDto extends LangQueryDto {
  @ApiPropertyOptional({
    description: `How many records to return (max ${MAX_LIMIT}).`,
    minimum: MIN_LIMIT,
    maximum: MAX_LIMIT,
    default: DEFAULT_LIMIT,
  })
  @IsInt({ message: i18nValidationMessage('validation.IS_INT') })
  @Min(MIN_LIMIT, { message: i18nValidationMessage('validation.MIN') })
  @Max(MAX_LIMIT, { message: i18nValidationMessage('validation.MAX') })
  limit: number = DEFAULT_LIMIT;

  @ApiPropertyOptional({
    description: 'How many records to skip.',
    minimum: MIN_OFFSET,
    default: DEFAULT_OFFSET,
  })
  @IsInt({ message: i18nValidationMessage('validation.IS_INT') })
  @Min(MIN_OFFSET, { message: i18nValidationMessage('validation.MIN') })
  offset: number = DEFAULT_OFFSET;
}
