import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsCreditCard,
  IsInt,
  IsObject,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

import { VALIDATION_MESSAGES } from '../../../common/constants/validation-messages';
import { MONTHS_PER_YEAR } from '../../../common/constants/time';
import { RequiredTextField } from '../../../orders/dto/order-fields.decorator';
import { CLIENT_SECRET_MAX_LENGTH } from '../../payments.constants';
import { CardConfirmation } from '../interfaces/simulator-input.interface';
import {
  CARD_NUMBER_MAX_LENGTH,
  CARD_NUMBER_SEPARATORS,
  CVC_PATTERN,
  MAX_EXP_YEAR,
  MIN_EXP_YEAR,
} from '../payment-simulator.constants';

const digitsOnly = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.replace(CARD_NUMBER_SEPARATORS, '') : value;

export class ConfirmIntentBodyDto implements CardConfirmation {
  @RequiredTextField(
    CLIENT_SECRET_MAX_LENGTH,
    'mock_pi_3f9a1c0d2b7e4a5f6c8d9e0a_secret_9b8a7c6d5e4f3a2b1c0d',
  )
  clientSecret: string;

  @ApiProperty({
    description:
      'A test card: 4242 4242 4242 4242 pays, 4000 0025 0000 3155 asks ' +
      'for 3D Secure, 4000 0000 0000 0002 is declined.',
    example: '4242 4242 4242 4242',
    maxLength: CARD_NUMBER_MAX_LENGTH,
  })
  @IsString(VALIDATION_MESSAGES.isString)
  @MaxLength(CARD_NUMBER_MAX_LENGTH, VALIDATION_MESSAGES.maxLength)
  @IsCreditCard(VALIDATION_MESSAGES.cardNumber)
  @Transform(digitsOnly)
  cardNumber: string;

  @ApiProperty({ minimum: 1, maximum: MONTHS_PER_YEAR, example: 12 })
  @IsInt(VALIDATION_MESSAGES.isInt)
  @Min(1, VALIDATION_MESSAGES.min)
  @Max(MONTHS_PER_YEAR, VALIDATION_MESSAGES.max)
  expMonth: number;

  @ApiProperty({ minimum: MIN_EXP_YEAR, maximum: MAX_EXP_YEAR, example: 2030 })
  @IsInt(VALIDATION_MESSAGES.isInt)
  @Min(MIN_EXP_YEAR, VALIDATION_MESSAGES.min)
  @Max(MAX_EXP_YEAR, VALIDATION_MESSAGES.max)
  expYear: number;

  @ApiProperty({ example: '123' })
  @IsString(VALIDATION_MESSAGES.isString)
  @Matches(CVC_PATTERN, VALIDATION_MESSAGES.cvcFormat)
  cvc: string;
}

export class ConfirmIntentDto {
  @ApiProperty({ type: ConfirmIntentBodyDto })
  @IsObject(VALIDATION_MESSAGES.isObject)
  @ValidateNested()
  @Type(() => ConfirmIntentBodyDto)
  confirmation: ConfirmIntentBodyDto;
}
