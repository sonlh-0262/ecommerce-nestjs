import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsObject, ValidateNested } from 'class-validator';

import { VALIDATION_MESSAGES } from '../../common/constants/validation-messages';
import {
  ReferenceUrlField,
  SuggestionDescriptionField,
  SuggestionNameField,
} from './suggestion-fields.decorator';

export class CreateSuggestionBodyDto {
  @SuggestionNameField()
  name: string;

  @SuggestionDescriptionField()
  description: string;

  @ReferenceUrlField()
  referenceUrl?: string | null;
}

export class CreateSuggestionDto {
  @ApiProperty({ type: CreateSuggestionBodyDto })
  @IsObject(VALIDATION_MESSAGES.isObject)
  @ValidateNested()
  @Type(() => CreateSuggestionBodyDto)
  suggestion: CreateSuggestionBodyDto;
}
