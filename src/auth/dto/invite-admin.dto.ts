import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsObject, ValidateNested } from 'class-validator';

import { VALIDATION_MESSAGES } from '../../common/constants/validation-messages';
import {
  EmailField,
  FullNameField,
  UsernameField,
} from '../../users/dto/user-fields.decorator';

export class InviteAdminBodyDto {
  @EmailField()
  email: string;

  @UsernameField()
  username: string;

  @FullNameField()
  fullName?: string;
}

export class InviteAdminDto {
  @ApiProperty({ type: InviteAdminBodyDto })
  @IsObject(VALIDATION_MESSAGES.isObject)
  @ValidateNested()
  @Type(() => InviteAdminBodyDto)
  admin: InviteAdminBodyDto;
}
