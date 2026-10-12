import { applyDecorators } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  Length,
} from 'class-validator';

import { VALIDATION_MESSAGES } from '../../common/constants/validation-messages';
import { trim } from '../../common/transforms/trim';
import { IsOptionalNotNull } from '../../common/validators/is-optional-not-null.validator';
import { NAME_MAX_LENGTH, NAME_MIN_LENGTH } from '../categories.constants';

export const CategoryNameField = ({ optional = false } = {}) =>
  applyDecorators(
    ApiProperty({
      example: 'Thời trang nam',
      minLength: NAME_MIN_LENGTH,
      maxLength: NAME_MAX_LENGTH,
      required: !optional,
    }),
    ...(optional ? [IsOptionalNotNull()] : []),
    IsString(VALIDATION_MESSAGES.isString),
    Length(NAME_MIN_LENGTH, NAME_MAX_LENGTH, VALIDATION_MESSAGES.length),
    Transform(trim),
  );

export const ParentIdField = ({ nullable = false } = {}) =>
  applyDecorators(
    ApiProperty({
      format: 'uuid',
      required: false,
      nullable,
      description: nullable
        ? 'A root category id, or null to move the category to the top level.'
        : 'A root category id. Omit to create a root category.',
    }),
    IsOptional(),
    IsUUID('all', VALIDATION_MESSAGES.isUuid),
  );

export const IsActiveField = () =>
  applyDecorators(
    ApiProperty({
      required: false,
      description:
        'Hiding a category only drops it from menus: its products stay listed.',
    }),
    IsOptionalNotNull(),
    IsBoolean(VALIDATION_MESSAGES.isBoolean),
  );
