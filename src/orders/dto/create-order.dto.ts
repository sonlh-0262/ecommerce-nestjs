import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsObject, Matches, ValidateNested } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';

import { VALIDATION_MESSAGES } from '../../common/constants/validation-messages';
import { PHONE_PATTERN } from '../../users/users.constants';
import { PaymentMethod } from '../enums/payment-method.enum';
import {
  NOTE_MAX_LENGTH,
  RECEIVER_NAME_MAX_LENGTH,
  RECEIVER_PHONE_MAX_LENGTH,
  SHIPPING_ADDRESS_MAX_LENGTH,
} from '../orders.constants';
import { OptionalTextField, RequiredTextField } from './order-fields.decorator';

export class CreateOrderBodyDto {
  @RequiredTextField(RECEIVER_NAME_MAX_LENGTH, 'Lanh Hung Son')
  receiverName: string;

  @RequiredTextField(RECEIVER_PHONE_MAX_LENGTH, '0901234567')
  @Matches(PHONE_PATTERN, {
    message: i18nValidationMessage('validation.PHONE_FORMAT'),
  })
  receiverPhone: string;

  @RequiredTextField(SHIPPING_ADDRESS_MAX_LENGTH, '1 Nguyen Trai, Ha Noi')
  shippingAddress: string;

  @OptionalTextField(NOTE_MAX_LENGTH, 'Call before delivering')
  note?: string | null;

  @ApiProperty({ enum: PaymentMethod, enumName: 'PaymentMethod' })
  @IsIn(Object.values(PaymentMethod), VALIDATION_MESSAGES.isIn)
  paymentMethod: PaymentMethod;
}

export class CreateOrderDto {
  @ApiProperty({ type: CreateOrderBodyDto })
  @IsObject(VALIDATION_MESSAGES.isObject)
  @ValidateNested()
  @Type(() => CreateOrderBodyDto)
  order: CreateOrderBodyDto;
}
