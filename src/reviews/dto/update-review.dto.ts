import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsObject, ValidateNested } from 'class-validator';

import { VALIDATION_MESSAGES } from '../../common/constants/validation-messages';
import { AtLeastOneField } from '../../common/validators/at-least-one-field.validator';
import { ContentField, RatingField } from './review-fields.decorator';

export class UpdateReviewBodyDto {
  @RatingField({ optional: true })
  rating?: number;

  @ContentField({ optional: true })
  content?: string;
}

export class UpdateReviewDto {
  @ApiProperty({ type: UpdateReviewBodyDto })
  @IsObject(VALIDATION_MESSAGES.isObject)
  @AtLeastOneField(VALIDATION_MESSAGES.atLeastOneField)
  @ValidateNested()
  @Type(() => UpdateReviewBodyDto)
  review: UpdateReviewBodyDto;
}
