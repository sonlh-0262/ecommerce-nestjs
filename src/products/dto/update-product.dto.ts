import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsObject, ValidateNested } from 'class-validator';

import { VALIDATION_MESSAGES } from '../../common/constants/validation-messages';
import { AtLeastOneField } from '../../common/validators/at-least-one-field.validator';
import { ProductStatus } from '../enums/product-status.enum';
import {
  CategoryIdField,
  DescriptionField,
  IsFeaturedField,
  PriceField,
  ProductNameField,
  ProductStatusField,
  SalePriceField,
  StockField,
} from './product-fields.decorator';

export class UpdateProductBodyDto {
  @ProductNameField({ optional: true })
  name?: string;

  @DescriptionField()
  description?: string | null;

  @PriceField({ optional: true })
  price?: number;

  @SalePriceField()
  salePrice?: number | null;

  @StockField({ optional: true })
  stock?: number;

  @CategoryIdField({ optional: true })
  categoryId?: string;

  @ProductStatusField()
  status?: ProductStatus;

  @IsFeaturedField()
  isFeatured?: boolean;
}

export class UpdateProductDto {
  @ApiProperty({ type: UpdateProductBodyDto })
  @IsObject(VALIDATION_MESSAGES.isObject)
  @AtLeastOneField(VALIDATION_MESSAGES.atLeastOneField)
  @ValidateNested()
  @Type(() => UpdateProductBodyDto)
  product: UpdateProductBodyDto;
}
