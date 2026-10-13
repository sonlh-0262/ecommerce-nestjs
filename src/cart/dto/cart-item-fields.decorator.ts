import { applyDecorators } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';

import { VALIDATION_MESSAGES } from '../../common/constants/validation-messages';
import {
  CART_ITEM_MAX_QUANTITY,
  CART_ITEM_MIN_QUANTITY,
} from '../cart.constants';

export const CartQuantityField = (description: string) =>
  applyDecorators(
    ApiProperty({
      minimum: CART_ITEM_MIN_QUANTITY,
      maximum: CART_ITEM_MAX_QUANTITY,
      example: 2,
      description,
    }),
    IsInt(VALIDATION_MESSAGES.isInt),
    Min(CART_ITEM_MIN_QUANTITY, VALIDATION_MESSAGES.min),
    Max(CART_ITEM_MAX_QUANTITY, VALIDATION_MESSAGES.max),
  );
