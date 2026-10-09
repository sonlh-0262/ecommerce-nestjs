import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsObject, ValidateNested } from 'class-validator';

import { VALIDATION_MESSAGES } from '../../common/constants/validation-messages';
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

export class CreateProductBodyDto {
  @ProductNameField()
  name: string;

  @DescriptionField()
  description?: string | null;

  @PriceField()
  price: number;

  @SalePriceField()
  salePrice?: number | null;

  @StockField()
  stock: number;

  @CategoryIdField()
  categoryId: string;

  @ProductStatusField()
  status?: ProductStatus;

  @IsFeaturedField()
  isFeatured?: boolean;
}

export class CreateProductDto {
  @ApiProperty({ type: CreateProductBodyDto })
  @IsObject(VALIDATION_MESSAGES.isObject)
  @ValidateNested()
  @Type(() => CreateProductBodyDto)
  product: CreateProductBodyDto;
}
