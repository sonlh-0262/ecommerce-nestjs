import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsObject, ValidateNested } from 'class-validator';

import { VALIDATION_MESSAGES } from '../../../common/constants/validation-messages';
import { RequiredTextField } from '../../../orders/dto/order-fields.decorator';
import { CLIENT_SECRET_MAX_LENGTH } from '../../payments.constants';
import { CardAuthentication } from '../interfaces/simulator-input.interface';

export class AuthenticateIntentBodyDto implements CardAuthentication {
  @RequiredTextField(
    CLIENT_SECRET_MAX_LENGTH,
    'mock_pi_3f9a1c0d2b7e4a5f6c8d9e0a_secret_9b8a7c6d5e4f3a2b1c0d',
  )
  clientSecret: string;

  @ApiProperty({
    description: 'true completes 3D Secure, false fails it.',
    example: true,
  })
  @IsBoolean(VALIDATION_MESSAGES.isBoolean)
  approve: boolean;
}

export class AuthenticateIntentDto {
  @ApiProperty({ type: AuthenticateIntentBodyDto })
  @IsObject(VALIDATION_MESSAGES.isObject)
  @ValidateNested()
  @Type(() => AuthenticateIntentBodyDto)
  authentication: AuthenticateIntentBodyDto;
}
