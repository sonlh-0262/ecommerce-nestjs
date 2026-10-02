import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsObject,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';

import { trimLower } from '../../common/transforms/trim';
import { EMAIL_MAX_LENGTH } from '../../users/users.constants';

export class LoginUserBodyDto {
  @ApiProperty({
    example: 'son@example.com',
    format: 'email',
    maxLength: EMAIL_MAX_LENGTH,
  })
  @IsEmail({}, { message: i18nValidationMessage('validation.IS_EMAIL') })
  // The column is this wide, so anything longer could never have registered -
  // and the limit the Swagger schema advertises has to be enforced somewhere.
  @MaxLength(EMAIL_MAX_LENGTH, {
    message: i18nValidationMessage('validation.MAX_LENGTH'),
  })
  @Transform(trimLower)
  email: string;

  /**
   * Only checked for presence. Length rules belong to registration: enforcing
   * them here would tell an attacker which guesses are even worth submitting,
   * and would lock out accounts whose password predates a rule change.
   */
  @ApiProperty({ example: 'Password@123', format: 'password' })
  @IsString({ message: i18nValidationMessage('validation.IS_STRING') })
  @IsNotEmpty({ message: i18nValidationMessage('validation.NOT_EMPTY') })
  password: string;
}

export class LoginUserDto {
  @ApiProperty({ type: LoginUserBodyDto })
  @IsObject({ message: i18nValidationMessage('validation.IS_OBJECT') })
  @ValidateNested()
  @Type(() => LoginUserBodyDto)
  user: LoginUserBodyDto;
}
