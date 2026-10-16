import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

import { VALIDATION_MESSAGES } from '../../common/constants/validation-messages';
import { trimToNull } from '../../common/transforms/trim';
import { CODE_MAX_LENGTH } from '../orders.constants';
import { OrdersQueryDto } from './orders-query.dto';

export class AdminOrdersQueryDto extends OrdersQueryDto {
  @ApiPropertyOptional({
    description: 'Orders whose code starts with this text, ignoring case.',
    maxLength: CODE_MAX_LENGTH,
    example: 'ORD-20261005',
  })
  @IsOptional()
  @IsString(VALIDATION_MESSAGES.isString)
  @MaxLength(CODE_MAX_LENGTH, VALIDATION_MESSAGES.maxLength)
  @Transform(trimToNull)
  code?: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Orders placed by this account.',
  })
  @IsOptional()
  @IsUUID('all', VALIDATION_MESSAGES.isUuid)
  userId?: string;
}
