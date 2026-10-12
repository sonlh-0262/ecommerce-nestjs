import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { SLUG_MAX_LENGTH as CATEGORY_SLUG_MAX_LENGTH } from '../../categories/categories.constants';
import { MAX_LIMIT, MIN_LIMIT } from '../../common/constants/pagination';
import { VALIDATION_MESSAGES } from '../../common/constants/validation-messages';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { toBoolean } from '../../common/transforms/boolean';
import { trimToNull } from '../../common/transforms/trim';
import { RATING_MAX, RATING_MIN } from '../../reviews/reviews.constants';
import {
  DEFAULT_PRODUCT_SORT,
  FEATURED_PRODUCTS_DEFAULT_LIMIT,
  MAX_PRICE,
  MIN_PRICE,
  PRODUCT_SEARCH_MAX_LENGTH,
  PRODUCT_SORTS,
  ProductSort,
} from '../products.constants';

export class ProductsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description:
      'Full-text search on name and description; accents are ignored, so ' +
      '"ao thun" finds "Áo Thun". Results are ranked by relevance first.',
    maxLength: PRODUCT_SEARCH_MAX_LENGTH,
    example: 'ao thun',
  })
  @IsOptional()
  @IsString(VALIDATION_MESSAGES.isString)
  @MaxLength(PRODUCT_SEARCH_MAX_LENGTH, VALIDATION_MESSAGES.maxLength)
  @Transform(trimToNull)
  q?: string | null;

  @ApiPropertyOptional({
    description: 'Category slug; a root category includes its sub-categories.',
    example: 'thoi-trang-nam',
  })
  @IsOptional()
  @IsString(VALIDATION_MESSAGES.isString)
  @MaxLength(CATEGORY_SLUG_MAX_LENGTH, VALIDATION_MESSAGES.maxLength)
  category?: string;

  @ApiPropertyOptional({
    description: 'Lowest effective price (sale price when set), in VND.',
    minimum: MIN_PRICE,
  })
  @IsOptional()
  @IsInt(VALIDATION_MESSAGES.isInt)
  @Min(MIN_PRICE, VALIDATION_MESSAGES.min)
  @Max(MAX_PRICE, VALIDATION_MESSAGES.max)
  minPrice?: number;

  @ApiPropertyOptional({
    description: 'Highest effective price (sale price when set), in VND.',
    minimum: MIN_PRICE,
  })
  @IsOptional()
  @IsInt(VALIDATION_MESSAGES.isInt)
  @Min(MIN_PRICE, VALIDATION_MESSAGES.min)
  @Max(MAX_PRICE, VALIDATION_MESSAGES.max)
  maxPrice?: number;

  @ApiPropertyOptional({ minimum: RATING_MIN, maximum: RATING_MAX })
  @IsOptional()
  @IsNumber({}, VALIDATION_MESSAGES.isNumber)
  @Min(RATING_MIN, VALIDATION_MESSAGES.min)
  @Max(RATING_MAX, VALIDATION_MESSAGES.max)
  minRating?: number;

  @ApiPropertyOptional({
    type: Boolean,
    description: '`true` for products in stock, `false` for sold-out ones.',
  })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean(VALIDATION_MESSAGES.isBoolean)
  inStock?: boolean;

  @ApiPropertyOptional({
    enum: PRODUCT_SORTS,
    default: DEFAULT_PRODUCT_SORT,
    description: 'Secondary order when `q` is set.',
  })
  @IsIn(PRODUCT_SORTS, VALIDATION_MESSAGES.isIn)
  sort: ProductSort = DEFAULT_PRODUCT_SORT;
}

export class FeaturedProductsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: `How many records to return (max ${MAX_LIMIT}).`,
    minimum: MIN_LIMIT,
    maximum: MAX_LIMIT,
    default: FEATURED_PRODUCTS_DEFAULT_LIMIT,
  })
  override limit: number = FEATURED_PRODUCTS_DEFAULT_LIMIT;
}
