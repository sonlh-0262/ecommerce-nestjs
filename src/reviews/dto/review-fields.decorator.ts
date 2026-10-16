import { applyDecorators } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsString, Length, Max, Min } from 'class-validator';

import { VALIDATION_MESSAGES } from '../../common/constants/validation-messages';
import { trim } from '../../common/transforms/trim';
import { IsOptionalNotNull } from '../../common/validators/is-optional-not-null.validator';
import {
  CONTENT_MAX_LENGTH,
  CONTENT_MIN_LENGTH,
  RATING_MAX,
  RATING_MIN,
} from '../reviews.constants';

interface FieldOptions {
  optional?: boolean;
  description?: string;
}

const OptionalWhen = (optional: boolean) =>
  optional ? [IsOptionalNotNull()] : [];

export const RatingField = ({
  optional = false,
  description,
}: FieldOptions = {}) =>
  applyDecorators(
    ApiProperty({
      minimum: RATING_MIN,
      maximum: RATING_MAX,
      example: 5,
      required: !optional,
      description,
    }),
    ...OptionalWhen(optional),
    IsInt(VALIDATION_MESSAGES.isInt),
    Min(RATING_MIN, VALIDATION_MESSAGES.min),
    Max(RATING_MAX, VALIDATION_MESSAGES.max),
  );

export const ContentField = ({ optional = false }: FieldOptions = {}) =>
  applyDecorators(
    ApiProperty({
      minLength: CONTENT_MIN_LENGTH,
      maxLength: CONTENT_MAX_LENGTH,
      example: 'Vải mát, mặc vừa người, giao hàng nhanh.',
      required: !optional,
    }),
    ...OptionalWhen(optional),
    IsString(VALIDATION_MESSAGES.isString),
    Length(CONTENT_MIN_LENGTH, CONTENT_MAX_LENGTH, VALIDATION_MESSAGES.length),
    Transform(trim),
  );
