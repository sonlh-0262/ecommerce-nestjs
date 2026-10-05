import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsObject, ValidateNested } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';

import {
  EmailField,
  FullNameField,
  NewPasswordField,
  UsernameField,
} from '../../users/dto/user-fields.decorator';

export class RegisterUserBodyDto {
  @EmailField()
  email: string;

  @UsernameField()
  username: string;

  @NewPasswordField()
  password: string;

  @FullNameField()
  fullName?: string;
}

export class RegisterUserDto {
  @ApiProperty({ type: RegisterUserBodyDto })
  @IsObject({ message: i18nValidationMessage('validation.IS_OBJECT') })
  @ValidateNested()
  @Type(() => RegisterUserBodyDto)
  user: RegisterUserBodyDto;
}
