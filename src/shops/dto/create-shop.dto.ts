import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsObject, ValidateNested } from 'class-validator';

import { VALIDATION_MESSAGES } from '../../common/constants/validation-messages';
import {
  ShopAddressField,
  ShopDescriptionField,
  ShopNameField,
  ShopPhoneField,
} from './shop-fields.decorator';

export class CreateShopBodyDto {
  @ShopNameField()
  name: string;

  @ShopDescriptionField()
  description?: string | null;

  @ShopPhoneField()
  phone: string;

  @ShopAddressField()
  address: string;
}

export class CreateShopDto {
  @ApiProperty({ type: CreateShopBodyDto })
  @IsObject(VALIDATION_MESSAGES.isObject)
  @ValidateNested()
  @Type(() => CreateShopBodyDto)
  shop: CreateShopBodyDto;
}
