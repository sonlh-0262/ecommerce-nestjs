import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  MaxLength,
} from 'class-validator';

import { VALIDATION_MESSAGES } from '../../common/constants/validation-messages';
import { trim, trimToNull } from '../../common/transforms/trim';
import { SuggestionStatus } from '../enums/suggestion-status.enum';
import {
  ADMIN_NOTE_MAX_LENGTH,
  ADMIN_NOTE_MIN_LENGTH,
  DESCRIPTION_MAX_LENGTH,
  DESCRIPTION_MIN_LENGTH,
  NAME_MAX_LENGTH,
  NAME_MIN_LENGTH,
  REFERENCE_URL_MAX_LENGTH,
  REFERENCE_URL_PROTOCOLS,
  SUGGESTION_DECISIONS,
} from '../product-suggestions.constants';

export const SuggestionNameField = () =>
  applyDecorators(
    ApiProperty({
      minLength: NAME_MIN_LENGTH,
      maxLength: NAME_MAX_LENGTH,
      example: 'Bình giữ nhiệt inox 1 lít',
    }),
    IsString(VALIDATION_MESSAGES.isString),
    Length(NAME_MIN_LENGTH, NAME_MAX_LENGTH, VALIDATION_MESSAGES.length),
    Transform(trim),
  );

export const SuggestionDescriptionField = () =>
  applyDecorators(
    ApiProperty({
      minLength: DESCRIPTION_MIN_LENGTH,
      maxLength: DESCRIPTION_MAX_LENGTH,
      example:
        'Loại giữ nóng 12 tiếng, có quai xách, nhiều bạn trong nhóm đang tìm.',
    }),
    IsString(VALIDATION_MESSAGES.isString),
    Length(
      DESCRIPTION_MIN_LENGTH,
      DESCRIPTION_MAX_LENGTH,
      VALIDATION_MESSAGES.length,
    ),
    Transform(trim),
  );

export const ReferenceUrlField = () =>
  applyDecorators(
    ApiPropertyOptional({
      maxLength: REFERENCE_URL_MAX_LENGTH,
      nullable: true,
      example: 'https://example.com/binh-giu-nhiet',
    }),
    IsOptional(),
    IsUrl(
      { protocols: REFERENCE_URL_PROTOCOLS, require_protocol: true },
      VALIDATION_MESSAGES.isUrl,
    ),
    MaxLength(REFERENCE_URL_MAX_LENGTH, VALIDATION_MESSAGES.maxLength),
    Transform(trimToNull),
  );

export const SuggestionDecisionField = () =>
  applyDecorators(
    ApiProperty({
      enum: SUGGESTION_DECISIONS,
      example: SuggestionStatus.Approved,
    }),
    IsIn(SUGGESTION_DECISIONS, VALIDATION_MESSAGES.isIn),
  );

export const AdminNoteField = () =>
  applyDecorators(
    ApiPropertyOptional({
      minLength: ADMIN_NOTE_MIN_LENGTH,
      maxLength: ADMIN_NOTE_MAX_LENGTH,
      nullable: true,
      description: 'Required to reject. Shown to the author.',
      example: 'Đã có sản phẩm tương tự trong danh mục Gia dụng.',
    }),
    IsOptional(),
    IsString(VALIDATION_MESSAGES.isString),
    Length(
      ADMIN_NOTE_MIN_LENGTH,
      ADMIN_NOTE_MAX_LENGTH,
      VALIDATION_MESSAGES.length,
    ),
    Transform(trimToNull),
  );
