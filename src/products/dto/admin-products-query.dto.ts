import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional } from 'class-validator';

import { VALIDATION_MESSAGES } from '../../common/constants/validation-messages';
import { toBoolean } from '../../common/transforms/boolean';
import { ProductStatus } from '../enums/product-status.enum';
import { ProductsQueryDto } from './products-query.dto';

export class AdminProductsQueryDto extends ProductsQueryDto {
  @ApiPropertyOptional({ enum: ProductStatus, enumName: 'ProductStatus' })
  @IsOptional()
  @IsIn(Object.values(ProductStatus), VALIDATION_MESSAGES.isIn)
  status?: ProductStatus;

  @ApiPropertyOptional({
    type: Boolean,
    default: false,
    description: 'Include deleted products, which are always ARCHIVED.',
  })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean(VALIDATION_MESSAGES.isBoolean)
  includeDeleted?: boolean;
}
