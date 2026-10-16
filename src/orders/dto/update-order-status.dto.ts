import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  Length,
  ValidateNested,
} from 'class-validator';

import { VALIDATION_MESSAGES } from '../../common/constants/validation-messages';
import { trimToNull } from '../../common/transforms/trim';
import {
  ADMIN_SETTABLE_ORDER_STATUSES,
  AdminSettableOrderStatus,
  REASON_MAX_LENGTH,
  REASON_MIN_LENGTH,
} from '../orders.constants';

export class UpdateOrderStatusBodyDto {
  @ApiProperty({
    enum: ADMIN_SETTABLE_ORDER_STATUSES,
    example: 'CONFIRMED',
    description:
      'CANCELLED is left to the customer and PENDING is never set back.',
  })
  @IsIn(ADMIN_SETTABLE_ORDER_STATUSES, VALIDATION_MESSAGES.isIn)
  status: AdminSettableOrderStatus;

  @ApiPropertyOptional({
    minLength: REASON_MIN_LENGTH,
    maxLength: REASON_MAX_LENGTH,
    nullable: true,
    description:
      'Required to reject, and shown to the customer in the email. Kept in ' +
      'the history for any other status.',
    example: 'The shipping address is outside our delivery area',
  })
  @IsOptional()
  @IsString(VALIDATION_MESSAGES.isString)
  @Length(REASON_MIN_LENGTH, REASON_MAX_LENGTH, VALIDATION_MESSAGES.length)
  @Transform(trimToNull)
  reason?: string | null;
}

export class UpdateOrderStatusDto {
  @ApiProperty({ type: UpdateOrderStatusBodyDto })
  @IsObject(VALIDATION_MESSAGES.isObject)
  @ValidateNested()
  @Type(() => UpdateOrderStatusBodyDto)
  order: UpdateOrderStatusBodyDto;
}
