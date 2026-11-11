import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsObject, ValidateNested } from 'class-validator';

import { VALIDATION_MESSAGES } from '../../common/constants/validation-messages';
import { ShopDecision } from '../shops.constants';
import { ShopDecisionField, ShopReasonField } from './shop-fields.decorator';

export class ReviewShopBodyDto {
  @ShopDecisionField()
  status: ShopDecision;

  @ShopReasonField()
  reason?: string | null;
}

export class ReviewShopDto {
  @ApiProperty({ type: ReviewShopBodyDto })
  @IsObject(VALIDATION_MESSAGES.isObject)
  @ValidateNested()
  @Type(() => ReviewShopBodyDto)
  shop: ReviewShopBodyDto;
}
