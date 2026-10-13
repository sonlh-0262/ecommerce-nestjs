import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsObject, IsUUID, ValidateNested } from 'class-validator';

import { VALIDATION_MESSAGES } from '../../common/constants/validation-messages';
import { CartQuantityField } from './cart-item-fields.decorator';

export class AddCartItemBodyDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('all', VALIDATION_MESSAGES.isUuid)
  productId: string;

  @CartQuantityField(
    'Added to the quantity already in the cart for this product.',
  )
  quantity: number;
}

export class AddCartItemDto {
  @ApiProperty({ type: AddCartItemBodyDto })
  @IsObject(VALIDATION_MESSAGES.isObject)
  @ValidateNested()
  @Type(() => AddCartItemBodyDto)
  item: AddCartItemBodyDto;
}
