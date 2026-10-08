import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsObject, ValidateNested } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';

import {
  ADMIN_SETTABLE_STATUSES,
  AdminSettableStatus,
} from '../users.constants';

export class UpdateUserStatusBodyDto {
  @ApiProperty({ enum: ADMIN_SETTABLE_STATUSES, example: 'INACTIVE' })
  @IsIn(ADMIN_SETTABLE_STATUSES, {
    message: i18nValidationMessage('validation.IS_IN'),
  })
  status: AdminSettableStatus;
}

export class UpdateUserStatusDto {
  @ApiProperty({ type: UpdateUserStatusBodyDto })
  @IsObject({ message: i18nValidationMessage('validation.IS_OBJECT') })
  @ValidateNested()
  @Type(() => UpdateUserStatusBodyDto)
  user: UpdateUserStatusBodyDto;
}
