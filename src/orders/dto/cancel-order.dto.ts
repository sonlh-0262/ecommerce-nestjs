import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsObject, IsOptional, ValidateNested } from 'class-validator';

import { VALIDATION_MESSAGES } from '../../common/constants/validation-messages';
import { REASON_MAX_LENGTH } from '../orders.constants';
import { OptionalTextField } from './order-fields.decorator';

export class CancelOrderBodyDto {
  @OptionalTextField(REASON_MAX_LENGTH, 'Ordered the wrong size')
  reason?: string | null;
}

export class CancelOrderDto {
  @ApiPropertyOptional({ type: CancelOrderBodyDto })
  @IsOptional()
  @IsObject(VALIDATION_MESSAGES.isObject)
  @ValidateNested()
  @Type(() => CancelOrderBodyDto)
  order?: CancelOrderBodyDto;
}
