import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsObject, ValidateNested } from 'class-validator';

import { VALIDATION_MESSAGES } from '../../common/constants/validation-messages';
import { CartQuantityField } from './cart-item-fields.decorator';

export class UpdateCartItemBodyDto {
  @CartQuantityField(
    'Replaces the quantity. Remove the item with DELETE instead of 0.',
  )
  quantity: number;
}

export class UpdateCartItemDto {
  @ApiProperty({ type: UpdateCartItemBodyDto })
  @IsObject(VALIDATION_MESSAGES.isObject)
  @ValidateNested()
  @Type(() => UpdateCartItemBodyDto)
  item: UpdateCartItemBodyDto;
}
