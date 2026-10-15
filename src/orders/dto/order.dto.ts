import { ApiProperty } from '@nestjs/swagger';

import { paginated } from '../../common/helpers/paginated';
import { ErrorBodyDto } from '../../common/dto/error-response.dto';
import { OrderItem } from '../entities/order-item.entity';
import { OrderStatusHistory } from '../entities/order-status-history.entity';
import { Order } from '../entities/order.entity';
import { OrderStatus } from '../enums/order-status.enum';
import { PaymentMethod } from '../enums/payment-method.enum';
import { PaymentStatus } from '../enums/payment-status.enum';
import { OrderDetail } from '../interfaces/order-detail.interface';
import { OrderPage, OrderSummary } from '../interfaces/order-summary.interface';
import { UnavailableItem } from '../interfaces/unavailable-item.interface';
import {
  UNAVAILABLE_ITEM_REASONS,
  UnavailableItemReason,
} from '../orders.constants';

export class OrderItemDto {
  @ApiProperty({ format: 'uuid' })
  productId: string;

  @ApiProperty({
    description: 'Name when ordered, kept even if the product is renamed.',
    example: 'Áo thun cotton basic',
  })
  productName: string;

  @ApiProperty({ example: 'ao-thun-cotton-basic' })
  productSlug: string;

  @ApiProperty({ description: 'Price paid per unit, in VND.', example: 150000 })
  unitPrice: number;

  @ApiProperty({ example: 2 })
  quantity: number;

  @ApiProperty({ example: 300000 })
  lineTotal: number;

  @ApiProperty({ nullable: true, example: null })
  thumbnailUrl: string | null;
}

export class OrderStatusHistoryDto {
  @ApiProperty({
    enum: OrderStatus,
    enumName: 'OrderStatus',
    nullable: true,
    description: 'null for the entry written when the order was placed.',
  })
  fromStatus: OrderStatus | null;

  @ApiProperty({ enum: OrderStatus, enumName: 'OrderStatus' })
  toStatus: OrderStatus;

  @ApiProperty({ nullable: true, example: null })
  reason: string | null;

  @ApiProperty({ example: '2026-10-05T03:00:00.000Z' })
  createdAt: string;
}

export class OrderFieldsDto {
  @ApiProperty({ example: 'ORD-20261005-0001' })
  code: string;

  @ApiProperty({ enum: OrderStatus, enumName: 'OrderStatus' })
  status: OrderStatus;

  @ApiProperty({ enum: PaymentMethod, enumName: 'PaymentMethod' })
  paymentMethod: PaymentMethod;

  @ApiProperty({ enum: PaymentStatus, enumName: 'PaymentStatus' })
  paymentStatus: PaymentStatus;

  @ApiProperty({
    description: 'Subtotal plus shipping, in VND.',
    example: 330000,
  })
  total: number;

  @ApiProperty({ example: '2026-10-05T03:00:00.000Z' })
  createdAt: string;
}

export class OrderDto extends OrderFieldsDto {
  @ApiProperty({ nullable: true, example: null })
  paidAt: string | null;

  @ApiProperty({
    nullable: true,
    description: 'The bank transfer reference the customer declared.',
    example: null,
  })
  paymentTransactionRef: string | null;

  @ApiProperty({ example: 'Lanh Hung Son' })
  receiverName: string;

  @ApiProperty({ example: '0901234567' })
  receiverPhone: string;

  @ApiProperty({ example: '1 Nguyen Trai, Ha Noi' })
  shippingAddress: string;

  @ApiProperty({ nullable: true, example: null })
  note: string | null;

  @ApiProperty({ example: 300000 })
  subtotal: number;

  @ApiProperty({ example: 30000 })
  shippingFee: number;

  @ApiProperty({
    nullable: true,
    description: 'Why the order was cancelled or rejected.',
    example: null,
  })
  reason: string | null;

  @ApiProperty({ nullable: true, example: null })
  deliveredAt: string | null;

  @ApiProperty({ type: [OrderItemDto], description: 'By product name.' })
  items: OrderItemDto[];

  @ApiProperty({ type: [OrderStatusHistoryDto], description: 'Oldest first.' })
  statusHistory: OrderStatusHistoryDto[];
}

export class OrderResponseDto {
  @ApiProperty({ type: OrderDto })
  order: OrderDto;
}

export class OrderSummaryDto extends OrderFieldsDto {
  @ApiProperty({ description: 'Number of distinct products.', example: 2 })
  itemsCount: number;

  @ApiProperty({ nullable: true, example: 'Áo thun cotton basic' })
  firstItemName: string | null;

  @ApiProperty({
    nullable: true,
    description: 'Thumbnail of the first item.',
    example: null,
  })
  thumbnailUrl: string | null;
}

export class OrdersResponseDto {
  @ApiProperty({ type: [OrderSummaryDto], description: 'Newest first.' })
  orders: OrderSummaryDto[];

  @ApiProperty({
    description: 'Orders matching the filters, across every page.',
    example: 12,
  })
  ordersCount: number;
}

export class UnavailableItemDto implements UnavailableItem {
  @ApiProperty({ format: 'uuid' })
  productId: string;

  @ApiProperty({ example: 'Áo thun cotton basic' })
  name: string;

  @ApiProperty({ enum: Object.values(UNAVAILABLE_ITEM_REASONS) })
  reason: UnavailableItemReason;

  @ApiProperty({ example: 1 })
  availableStock: number;
}

export class ItemsUnavailableErrorDto extends ErrorBodyDto {
  @ApiProperty({
    type: [UnavailableItemDto],
    required: false,
    description: 'Every cart item that cannot be ordered, and why.',
  })
  items?: UnavailableItemDto[];
}

export class ItemsUnavailableErrorResponseDto {
  @ApiProperty({ type: ItemsUnavailableErrorDto })
  errors: ItemsUnavailableErrorDto;
}

function toOrderFields(order: Order): OrderFieldsDto {
  return {
    code: order.code,
    status: order.status,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    total: order.total,
    createdAt: order.createdAt.toISOString(),
  };
}

function toOrderItemDto(
  item: OrderItem,
  thumbnailUrls: Map<string, string>,
): OrderItemDto {
  return {
    productId: item.productId,
    productName: item.productName,
    productSlug: item.productSlug,
    unitPrice: item.unitPrice,
    quantity: item.quantity,
    lineTotal: item.lineTotal,
    thumbnailUrl: thumbnailUrls.get(item.productId) ?? null,
  };
}

export function toStatusHistoryDto(
  entry: OrderStatusHistory,
): OrderStatusHistoryDto {
  return {
    fromStatus: entry.fromStatus,
    toStatus: entry.toStatus,
    reason: entry.reason,
    createdAt: entry.createdAt.toISOString(),
  };
}

export function toOrderResponse(detail: OrderDetail): OrderResponseDto {
  const { order } = detail;

  return {
    order: {
      ...toOrderFields(order),
      paidAt: order.paidAt?.toISOString() ?? null,
      paymentTransactionRef: order.paymentTransactionRef,
      receiverName: order.receiverName,
      receiverPhone: order.receiverPhone,
      shippingAddress: order.shippingAddress,
      note: order.note,
      subtotal: order.subtotal,
      shippingFee: order.shippingFee,
      reason: order.reason,
      deliveredAt: order.deliveredAt?.toISOString() ?? null,
      items: detail.items.map((item) =>
        toOrderItemDto(item, detail.thumbnailUrls),
      ),
      statusHistory: detail.history.map(toStatusHistoryDto),
    },
  };
}

export function toOrderSummaryDto(summary: OrderSummary): OrderSummaryDto {
  return {
    ...toOrderFields(summary.order),
    itemsCount: summary.itemsCount,
    firstItemName: summary.firstItem?.productName ?? null,
    thumbnailUrl: summary.thumbnailUrl,
  };
}

export function toOrdersResponse(page: OrderPage): OrdersResponseDto {
  return paginated('orders', page.summaries.map(toOrderSummaryDto), page.total);
}
