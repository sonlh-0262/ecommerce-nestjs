import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsISO8601, IsOptional } from 'class-validator';

import { VALIDATION_MESSAGES } from '../../common/constants/validation-messages';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { OrderStatus } from '../enums/order-status.enum';

export class OrdersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: OrderStatus, enumName: 'OrderStatus' })
  @IsOptional()
  @IsIn(Object.values(OrderStatus), VALIDATION_MESSAGES.isIn)
  status?: OrderStatus;

  @ApiPropertyOptional({
    description: 'Orders placed at or after this moment (ISO 8601).',
    example: '2026-10-01T00:00:00+07:00',
  })
  @IsOptional()
  @IsISO8601({ strict: true }, VALIDATION_MESSAGES.isDate)
  from?: string;

  @ApiPropertyOptional({
    description:
      'Orders placed at or before this moment (ISO 8601). A bare date ' +
      'means midnight UTC, so pass a full timestamp to include that day.',
    example: '2026-10-31T23:59:59+07:00',
  })
  @IsOptional()
  @IsISO8601({ strict: true }, VALIDATION_MESSAGES.isDate)
  to?: string;
}
