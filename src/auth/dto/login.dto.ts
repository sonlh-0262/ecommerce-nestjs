import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsObject,
  IsString,
  ValidateNested,
} from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';

import { EmailField } from '../../users/dto/user-fields.decorator';

export class LoginUserBodyDto {
  @EmailField()
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
