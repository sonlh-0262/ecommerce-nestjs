import { ApiProperty, OmitType } from '@nestjs/swagger';

import { paginated } from '../../common/helpers/paginated';
import {
  AdminOrderDetail,
  AdminOrderPage,
  AdminOrderSummary,
  OrderUser,
} from '../interfaces/admin-order.interface';
import {
  OrderDto,
  OrderStatusHistoryDto,
  OrderSummaryDto,
  toOrderResponse,
  toOrderSummaryDto,
  toStatusHistoryDto,
} from './order.dto';

export class OrderUserDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'son@example.com', format: 'email' })
  email: string;

  @ApiProperty({ example: 'sonlh' })
  username: string;

  @ApiProperty({ nullable: true, example: 'Lanh Hung Son' })
  fullName: string | null;
}

export class AdminOrderStatusHistoryDto extends OrderStatusHistoryDto {
  @ApiProperty({
    type: OrderUserDto,
    nullable: true,
    description:
      'Who made the change: the customer for placing and cancelling, an ' +
      'admin otherwise. null once that account is gone.',
  })
  changedBy: OrderUserDto | null;
}

export class AdminOrderDto extends OmitType(OrderDto, ['statusHistory']) {
  @ApiProperty({ type: OrderUserDto, description: 'Who placed the order.' })
  user: OrderUserDto;

  @ApiProperty({
    type: [AdminOrderStatusHistoryDto],
    description: 'Oldest first.',
  })
  statusHistory: AdminOrderStatusHistoryDto[];
}

export class AdminOrderResponseDto {
  @ApiProperty({ type: AdminOrderDto })
  order: AdminOrderDto;
}

export class AdminOrderSummaryDto extends OrderSummaryDto {
  @ApiProperty({ type: OrderUserDto, description: 'Who placed the order.' })
  user: OrderUserDto;
}

export class AdminOrdersResponseDto {
  @ApiProperty({ type: [AdminOrderSummaryDto], description: 'Newest first.' })
  orders: AdminOrderSummaryDto[];

  @ApiProperty({
    description: 'Orders matching the filters, across every page.',
    example: 12,
  })
  ordersCount: number;
}

function toOrderUserDto(user: OrderUser): OrderUserDto {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    fullName: user.fullName,
  };
}

export function toAdminOrderResponse(
  detail: AdminOrderDetail,
): AdminOrderResponseDto {
  const { order } = toOrderResponse(detail);

  return {
    order: {
      ...order,
      user: toOrderUserDto(detail.customer),
      statusHistory: detail.history.map((entry) => {
        const actor = entry.changedBy
          ? detail.actors.get(entry.changedBy)
          : undefined;

        return {
          ...toStatusHistoryDto(entry),
          changedBy: actor ? toOrderUserDto(actor) : null,
        };
      }),
    },
  };
}

function toAdminOrderSummaryDto(
  summary: AdminOrderSummary,
): AdminOrderSummaryDto {
  return {
    ...toOrderSummaryDto(summary),
    user: toOrderUserDto(summary.customer),
  };
}

export function toAdminOrdersResponse(
  page: AdminOrderPage,
): AdminOrdersResponseDto {
  return paginated(
    'orders',
    page.summaries.map(toAdminOrderSummaryDto),
    page.total,
  );
}
