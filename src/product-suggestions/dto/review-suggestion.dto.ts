import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsObject, ValidateNested } from 'class-validator';

import { VALIDATION_MESSAGES } from '../../common/constants/validation-messages';
import { SuggestionDecision } from '../product-suggestions.constants';
import {
  AdminNoteField,
  SuggestionDecisionField,
} from './suggestion-fields.decorator';

export class ReviewSuggestionBodyDto {
  @SuggestionDecisionField()
  status: SuggestionDecision;

  @AdminNoteField()
  adminNote?: string | null;
}

export class ReviewSuggestionDto {
  @ApiProperty({ type: ReviewSuggestionBodyDto })
  @IsObject(VALIDATION_MESSAGES.isObject)
  @ValidateNested()
  @Type(() => ReviewSuggestionBodyDto)
  suggestion: ReviewSuggestionBodyDto;
}
