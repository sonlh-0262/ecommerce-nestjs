import { ApiProperty, OmitType } from '@nestjs/swagger';

import { paginated } from '../../common/helpers/paginated';
import { toUserRef, UserRefDto } from '../../users/dto/user-ref.dto';
import {
  AdminOrderDetail,
  AdminOrderPage,
  AdminOrderSummary,
} from '../interfaces/admin-order.interface';
import {
  OrderDto,
  OrderStatusHistoryDto,
  OrderSummaryDto,
  toOrderResponse,
  toOrderSummaryDto,
  toStatusHistoryDto,
} from './order.dto';

export class AdminOrderStatusHistoryDto extends OrderStatusHistoryDto {
  @ApiProperty({
    type: UserRefDto,
    nullable: true,
    description:
      'Who made the change: the customer for placing and cancelling, the ' +
      'admin or the shop owner otherwise. null once that account is gone.',
  })
  changedBy: UserRefDto | null;
}

export class AdminOrderDto extends OmitType(OrderDto, ['statusHistory']) {
  @ApiProperty({ type: UserRefDto, description: 'Who placed the order.' })
  user: UserRefDto;

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
  @ApiProperty({ type: UserRefDto, description: 'Who placed the order.' })
  user: UserRefDto;
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

export function toAdminOrderResponse(
  detail: AdminOrderDetail,
): AdminOrderResponseDto {
  const { order } = toOrderResponse(detail);

  return {
    order: {
      ...order,
      user: toUserRef(detail.customer),
      statusHistory: detail.history.map((entry) => {
        const actor = entry.changedBy
          ? detail.actors.get(entry.changedBy)
          : undefined;

        return {
          ...toStatusHistoryDto(entry),
          changedBy: actor ? toUserRef(actor) : null,
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
    user: toUserRef(summary.customer),
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
