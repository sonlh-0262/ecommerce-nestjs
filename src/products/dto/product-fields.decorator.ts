import { applyDecorators } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { VALIDATION_MESSAGES } from '../../common/constants/validation-messages';
import { trim, trimToNull } from '../../common/transforms/trim';
import { IsOptionalNotNull } from '../../common/validators/is-optional-not-null.validator';
import { PG_INTEGER_MAX } from '../../database/database.constants';
import { ProductStatus } from '../enums/product-status.enum';
import {
  DESCRIPTION_MAX_LENGTH,
  MAX_PRICE,
  MIN_PRICE,
  MIN_STOCK,
  NAME_MAX_LENGTH,
  NAME_MIN_LENGTH,
} from '../products.constants';

interface FieldOptions {
  optional?: boolean;
}

const OptionalWhen = (optional: boolean) =>
  optional ? [IsOptionalNotNull()] : [];

export const ProductNameField = ({ optional = false }: FieldOptions = {}) =>
  applyDecorators(
    ApiProperty({
      example: 'Áo thun cotton basic',
      minLength: NAME_MIN_LENGTH,
      maxLength: NAME_MAX_LENGTH,
      required: !optional,
      description: 'Renaming keeps the slug, so existing links still work.',
    }),
    ...OptionalWhen(optional),
    IsString(VALIDATION_MESSAGES.isString),
    Length(NAME_MIN_LENGTH, NAME_MAX_LENGTH, VALIDATION_MESSAGES.length),
    Transform(trim),
  );

export const DescriptionField = () =>
  applyDecorators(
    ApiProperty({
      required: false,
      nullable: true,
      maxLength: DESCRIPTION_MAX_LENGTH,
      example: 'Vải cotton 100%, form regular.',
    }),
    IsOptional(),
    IsString(VALIDATION_MESSAGES.isString),
    MaxLength(DESCRIPTION_MAX_LENGTH, VALIDATION_MESSAGES.maxLength),
    Transform(trimToNull),
  );

export const PriceField = ({ optional = false }: FieldOptions = {}) =>
  applyDecorators(
    ApiProperty({
      description: 'Whole VND, no decimals.',
      minimum: MIN_PRICE,
      example: 250000,
      required: !optional,
    }),
    ...OptionalWhen(optional),
    IsInt(VALIDATION_MESSAGES.isInt),
    Min(MIN_PRICE, VALIDATION_MESSAGES.min),
    Max(MAX_PRICE, VALIDATION_MESSAGES.max),
  );

export const SalePriceField = () =>
  applyDecorators(
    ApiProperty({
      description: 'Whole VND, below `price`. null removes the discount.',
      minimum: MIN_PRICE,
      required: false,
      nullable: true,
      example: 199000,
    }),
    IsOptional(),
    IsInt(VALIDATION_MESSAGES.isInt),
    Min(MIN_PRICE, VALIDATION_MESSAGES.min),
    Max(MAX_PRICE, VALIDATION_MESSAGES.max),
  );

export const StockField = ({ optional = false }: FieldOptions = {}) =>
  applyDecorators(
    ApiProperty({ minimum: MIN_STOCK, example: 42, required: !optional }),
    ...OptionalWhen(optional),
    IsInt(VALIDATION_MESSAGES.isInt),
    Min(MIN_STOCK, VALIDATION_MESSAGES.min),
    Max(PG_INTEGER_MAX, VALIDATION_MESSAGES.max),
  );

export const CategoryIdField = ({ optional = false }: FieldOptions = {}) =>
  applyDecorators(
    ApiProperty({ format: 'uuid', required: !optional }),
    ...OptionalWhen(optional),
    IsUUID('all', VALIDATION_MESSAGES.isUuid),
  );

export const ProductStatusField = () =>
  applyDecorators(
    ApiProperty({
      enum: ProductStatus,
      enumName: 'ProductStatus',
      required: false,
      description: 'PUBLISHED needs at least one image. Defaults to DRAFT.',
    }),
    IsOptionalNotNull(),
    IsIn(Object.values(ProductStatus), VALIDATION_MESSAGES.isIn),
  );

export const IsFeaturedField = () =>
  applyDecorators(
    ApiProperty({ required: false, default: false }),
    IsOptionalNotNull(),
    IsBoolean(VALIDATION_MESSAGES.isBoolean),
  );
