import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

import { VALIDATION_MESSAGES } from '../../common/constants/validation-messages';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { SuggestionStatus } from '../enums/suggestion-status.enum';

export class SuggestionsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: SuggestionStatus, enumName: 'SuggestionStatus' })
  @IsOptional()
  @IsIn(Object.values(SuggestionStatus), VALIDATION_MESSAGES.isIn)
  status?: SuggestionStatus;
}
