import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsObject, ValidateNested } from 'class-validator';

import { VALIDATION_MESSAGES } from '../../common/constants/validation-messages';
import { PAYMENT_TRANSACTION_REF_MAX_LENGTH } from '../orders.constants';
import { RequiredTextField } from './order-fields.decorator';

export class PayOrderBodyDto {
  @RequiredTextField(PAYMENT_TRANSACTION_REF_MAX_LENGTH, 'FT26278123456')
  transactionRef: string;
}

export class PayOrderDto {
  @ApiProperty({ type: PayOrderBodyDto })
  @IsObject(VALIDATION_MESSAGES.isObject)
  @ValidateNested()
  @Type(() => PayOrderBodyDto)
  payment: PayOrderBodyDto;
}
