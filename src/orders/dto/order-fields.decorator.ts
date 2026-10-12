import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, Length, MaxLength } from 'class-validator';

import { VALIDATION_MESSAGES } from '../../common/constants/validation-messages';
import { trim, trimToNull } from '../../common/transforms/trim';

export const RequiredTextField = (maxLength: number, example: string) =>
  applyDecorators(
    ApiProperty({ minLength: 1, maxLength, example }),
    IsString(VALIDATION_MESSAGES.isString),
    Length(1, maxLength, VALIDATION_MESSAGES.length),
    Transform(trim),
  );

export const OptionalTextField = (maxLength: number, example: string) =>
  applyDecorators(
    ApiPropertyOptional({ maxLength, example, nullable: true }),
    IsOptional(),
    IsString(VALIDATION_MESSAGES.isString),
    MaxLength(maxLength, VALIDATION_MESSAGES.maxLength),
    Transform(trimToNull),
  );
