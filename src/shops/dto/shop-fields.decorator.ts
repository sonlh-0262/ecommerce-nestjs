import { applyDecorators } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

import { VALIDATION_MESSAGES } from '../../common/constants/validation-messages';
import { trim, trimToNull } from '../../common/transforms/trim';
import { IsOptionalNotNull } from '../../common/validators/is-optional-not-null.validator';
import {
  ADDRESS_MAX_LENGTH,
  PHONE_MAX_LENGTH,
  PHONE_PATTERN,
} from '../../users/users.constants';
import { ShopStatus } from '../enums/shop-status.enum';
import {
  DESCRIPTION_MAX_LENGTH,
  NAME_MAX_LENGTH,
  NAME_MIN_LENGTH,
  REASON_MAX_LENGTH,
  REASON_MIN_LENGTH,
  REQUIRED_TEXT_MIN_LENGTH,
  SHOP_DECISIONS,
} from '../shops.constants';

interface FieldOptions {
  optional?: boolean;
}

const OptionalWhen = (optional: boolean) =>
  optional ? [IsOptionalNotNull()] : [];

const TextField = (
  { optional = false }: FieldOptions,
  minLength: number,
  maxLength: number,
  example: string,
) =>
  applyDecorators(
    ApiProperty({ minLength, maxLength, example, required: !optional }),
    ...OptionalWhen(optional),
    IsString(VALIDATION_MESSAGES.isString),
    Length(minLength, maxLength, VALIDATION_MESSAGES.length),
    Transform(trim),
  );

export const ShopNameField = (options: FieldOptions = {}) =>
  TextField(options, NAME_MIN_LENGTH, NAME_MAX_LENGTH, 'Nhà Sách Hà Nội');

export const ShopAddressField = (options: FieldOptions = {}) =>
  TextField(
    options,
    REQUIRED_TEXT_MIN_LENGTH,
    ADDRESS_MAX_LENGTH,
    '12 Hang Bai, Ha Noi',
  );

export const ShopPhoneField = (options: FieldOptions = {}) =>
  applyDecorators(
    TextField(
      options,
      REQUIRED_TEXT_MIN_LENGTH,
      PHONE_MAX_LENGTH,
      '0901234567',
    ),
    Matches(PHONE_PATTERN, VALIDATION_MESSAGES.phoneFormat),
  );

export const ShopDescriptionField = () =>
  applyDecorators(
    ApiProperty({
      required: false,
      nullable: true,
      maxLength: DESCRIPTION_MAX_LENGTH,
      example: 'Sách giáo khoa và văn phòng phẩm, giao trong ngày.',
    }),
    IsOptional(),
    IsString(VALIDATION_MESSAGES.isString),
    MaxLength(DESCRIPTION_MAX_LENGTH, VALIDATION_MESSAGES.maxLength),
    Transform(trimToNull),
  );

export const ShopDecisionField = () =>
  applyDecorators(
    ApiProperty({ enum: SHOP_DECISIONS, example: ShopStatus.Active }),
    IsIn(SHOP_DECISIONS, VALIDATION_MESSAGES.isIn),
  );

export const ShopReasonField = () =>
  applyDecorators(
    ApiProperty({
      required: false,
      nullable: true,
      minLength: REASON_MIN_LENGTH,
      maxLength: REASON_MAX_LENGTH,
      description: 'Required to reject. Shown to the owner in the email.',
      example: 'Thiếu giấy phép kinh doanh cho ngành hàng này',
    }),
    IsOptional(),
    IsString(VALIDATION_MESSAGES.isString),
    Length(REASON_MIN_LENGTH, REASON_MAX_LENGTH, VALIDATION_MESSAGES.length),
    Transform(trimToNull),
  );
