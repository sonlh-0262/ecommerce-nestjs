import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

import { VALIDATION_MESSAGES } from '../../common/constants/validation-messages';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { trimToNull } from '../../common/transforms/trim';
import { ShopStatus } from '../enums/shop-status.enum';
import { SHOP_SEARCH_MAX_LENGTH } from '../shops.constants';

export class AdminShopsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ShopStatus, enumName: 'ShopStatus' })
  @IsOptional()
  @IsIn(Object.values(ShopStatus), VALIDATION_MESSAGES.isIn)
  status?: ShopStatus;

  @ApiPropertyOptional({
    description: 'Shops whose name or slug contains this text, ignoring case.',
    maxLength: SHOP_SEARCH_MAX_LENGTH,
  })
  @IsOptional()
  @IsString(VALIDATION_MESSAGES.isString)
  @MaxLength(SHOP_SEARCH_MAX_LENGTH, VALIDATION_MESSAGES.maxLength)
  @Transform(trimToNull)
  q?: string | null;
}
