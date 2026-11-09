import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsObject, ValidateNested } from 'class-validator';

import { VALIDATION_MESSAGES } from '../../common/constants/validation-messages';
import { AtLeastOneField } from '../../common/validators/at-least-one-field.validator';
import {
  ShopAddressField,
  ShopDescriptionField,
  ShopNameField,
  ShopPhoneField,
} from './shop-fields.decorator';

export class UpdateShopBodyDto {
  @ShopNameField({ optional: true })
  name?: string;

  @ShopDescriptionField()
  description?: string | null;

  @ShopPhoneField({ optional: true })
  phone?: string;

  @ShopAddressField({ optional: true })
  address?: string;
}

export class UpdateShopDto {
  @ApiProperty({ type: UpdateShopBodyDto })
  @IsObject(VALIDATION_MESSAGES.isObject)
  @AtLeastOneField(VALIDATION_MESSAGES.atLeastOneField)
  @ValidateNested()
  @Type(() => UpdateShopBodyDto)
  shop: UpdateShopBodyDto;
}
