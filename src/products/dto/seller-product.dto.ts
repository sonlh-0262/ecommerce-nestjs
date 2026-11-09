import { ApiProperty, OmitType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsObject, ValidateNested } from 'class-validator';

import { VALIDATION_MESSAGES } from '../../common/constants/validation-messages';
import { AtLeastOneField } from '../../common/validators/at-least-one-field.validator';
import { AdminProductsQueryDto } from './admin-products-query.dto';
import { CreateProductBodyDto } from './create-product.dto';
import { UpdateProductBodyDto } from './update-product.dto';

export class SellerCreateProductBodyDto extends OmitType(CreateProductBodyDto, [
  'isFeatured',
] as const) {}

export class SellerUpdateProductBodyDto extends OmitType(UpdateProductBodyDto, [
  'isFeatured',
] as const) {}

export class SellerProductsQueryDto extends OmitType(AdminProductsQueryDto, [
  'shop',
] as const) {}

export class SellerCreateProductDto {
  @ApiProperty({ type: SellerCreateProductBodyDto })
  @IsObject(VALIDATION_MESSAGES.isObject)
  @ValidateNested()
  @Type(() => SellerCreateProductBodyDto)
  product: SellerCreateProductBodyDto;
}

export class SellerUpdateProductDto {
  @ApiProperty({ type: SellerUpdateProductBodyDto })
  @IsObject(VALIDATION_MESSAGES.isObject)
  @AtLeastOneField(VALIDATION_MESSAGES.atLeastOneField)
  @ValidateNested()
  @Type(() => SellerUpdateProductBodyDto)
  product: SellerUpdateProductBodyDto;
}
