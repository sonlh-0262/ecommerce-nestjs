import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsObject,
  IsString,
  ValidateNested,
} from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';

import { NewPasswordField } from './user-fields.decorator';

export class ChangePasswordBodyDto {
  @ApiProperty({ example: 'Password@123', format: 'password' })
  @IsString({ message: i18nValidationMessage('validation.IS_STRING') })
  @IsNotEmpty({ message: i18nValidationMessage('validation.NOT_EMPTY') })
  currentPassword: string;

  @NewPasswordField()
  newPassword: string;
}

export class ChangePasswordDto {
  @ApiProperty({ type: ChangePasswordBodyDto })
  @IsObject({ message: i18nValidationMessage('validation.IS_OBJECT') })
  @ValidateNested()
  @Type(() => ChangePasswordBodyDto)
  user: ChangePasswordBodyDto;
}
