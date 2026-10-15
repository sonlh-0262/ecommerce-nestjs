import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsObject, ValidateNested } from 'class-validator';

import { VALIDATION_MESSAGES } from '../../common/constants/validation-messages';
import { ContentField, RatingField } from './review-fields.decorator';

export class CreateReviewBodyDto {
  @RatingField()
  rating: number;

  @ContentField()
  content: string;
}

export class CreateReviewDto {
  @ApiProperty({ type: CreateReviewBodyDto })
  @IsObject(VALIDATION_MESSAGES.isObject)
  @ValidateNested()
  @Type(() => CreateReviewBodyDto)
  review: CreateReviewBodyDto;
}
