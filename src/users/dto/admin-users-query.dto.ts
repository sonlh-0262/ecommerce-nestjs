import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';

import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { trimToNull } from '../../common/transforms/trim';
import { UserRole } from '../enums/user-role.enum';
import { UserStatus } from '../enums/user-status.enum';
import { ADMIN_USER_SEARCH_MAX_LENGTH } from '../users.constants';

const IS_IN = { message: i18nValidationMessage('validation.IS_IN') };

export class AdminUsersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Case-insensitive match on email or username.',
    maxLength: ADMIN_USER_SEARCH_MAX_LENGTH,
    example: 'son',
  })
  @IsOptional()
  @IsString({ message: i18nValidationMessage('validation.IS_STRING') })
  @MaxLength(ADMIN_USER_SEARCH_MAX_LENGTH, {
    message: i18nValidationMessage('validation.MAX_LENGTH'),
  })
  @Transform(trimToNull)
  q?: string | null;

  @ApiPropertyOptional({ enum: UserStatus, enumName: 'UserStatus' })
  @IsOptional()
  @IsIn(Object.values(UserStatus), IS_IN)
  status?: UserStatus;

  @ApiPropertyOptional({ enum: UserRole, enumName: 'UserRole' })
  @IsOptional()
  @IsIn(Object.values(UserRole), IS_IN)
  role?: UserRole;
}
