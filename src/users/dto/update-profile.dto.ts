import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsObject, ValidateNested } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';

import { AtLeastOneField } from '../../common/validators/at-least-one-field.validator';
import {
  AddressField,
  FullNameField,
  PhoneField,
  UsernameField,
} from './user-fields.decorator';

export class UpdateProfileBodyDto {
  @UsernameField({ optional: true })
  username?: string;

  @FullNameField()
  fullName?: string | null;

  @PhoneField()
  phone?: string | null;

  @AddressField()
  address?: string | null;
}

export class UpdateProfileDto {
  @ApiProperty({ type: UpdateProfileBodyDto })
  @IsObject({ message: i18nValidationMessage('validation.IS_OBJECT') })
  @AtLeastOneField({
    message: i18nValidationMessage('validation.AT_LEAST_ONE_FIELD'),
  })
  @ValidateNested()
  @Type(() => UpdateProfileBodyDto)
  user: UpdateProfileBodyDto;
}
