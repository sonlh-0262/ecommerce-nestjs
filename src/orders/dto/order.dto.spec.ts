import { buildShop } from '../../shops/entities/shop.fixture';
import { OrderItem } from '../entities/order-item.entity';
import { OrderStatusHistory } from '../entities/order-status-history.entity';
import { Order } from '../entities/order.entity';
import { OrderStatus } from '../enums/order-status.enum';
import { PaymentMethod } from '../enums/payment-method.enum';
import { PaymentStatus } from '../enums/payment-status.enum';
import {
  toOrderResponse,
  toOrdersResponse,
  toPlacedOrdersResponse,
} from './order.dto';

describe('order mappers', () => {
  const CREATED_AT = new Date('2026-10-05T03:00:00.000Z');

  const order = {
    id: 'o1',
    code: 'ORD-20261005-0001',
    userId: 'u1',
    status: OrderStatus.Pending,
    paymentMethod: PaymentMethod.Cod,
    paymentStatus: PaymentStatus.Unpaid,
    paymentTransactionRef: null,
    paidAt: null,
    receiverName: 'Lanh Hung Son',
    receiverPhone: '0901234567',
    shippingAddress: '1 Nguyen Trai, Ha Noi',
    note: null,
    subtotal: 300000,
    shippingFee: 30000,
    total: 330000,
    reason: null,
    deliveredAt: null,
    createdAt: CREATED_AT,
  } as Order;

  const item = {
    orderId: 'o1',
    productId: 'p1',
    productName: 'Áo thun',
    productSlug: 'ao-thun',
    unitPrice: 150000,
    quantity: 2,
    lineTotal: 300000,
  } as OrderItem;

  const detail = {
    order,
    shop: null,
    items: [item],
    history: [
      {
        fromStatus: null,
        toStatus: OrderStatus.Pending,
        reason: null,
        createdAt: CREATED_AT,
      } as OrderStatusHistory,
    ],
    thumbnailUrls: new Map([['p1', '/thumb']]),
  };

  it('maps the full order with its snapshot items and history', () => {
    const response = toOrderResponse(detail);

    expect(response).toEqual({
      order: {
        code: 'ORD-20261005-0001',
        status: OrderStatus.Pending,
        paymentMethod: PaymentMethod.Cod,
        paymentStatus: PaymentStatus.Unpaid,
        paidAt: null,
        paymentTransactionRef: null,
        receiverName: 'Lanh Hung Son',
        receiverPhone: '0901234567',
        shippingAddress: '1 Nguyen Trai, Ha Noi',
        note: null,
        subtotal: 300000,
        shippingFee: 30000,
        total: 330000,
        shop: null,
        reason: null,
        deliveredAt: null,
        createdAt: CREATED_AT.toISOString(),
        items: [
          {
            productId: 'p1',
            productName: 'Áo thun',
            productSlug: 'ao-thun',
            unitPrice: 150000,
            quantity: 2,
            lineTotal: 300000,
            thumbnailUrl: '/thumb',
          },
        ],
        statusHistory: [
          {
            fromStatus: null,
            toStatus: OrderStatus.Pending,
            reason: null,
            createdAt: CREATED_AT.toISOString(),
          },
        ],
      },
    });
  });

  it('names the shop of an order placed with a shop', () => {
    const shop = buildShop();

    expect(toOrderResponse({ ...detail, shop }).order.shop).toEqual({
      id: shop.id,
      name: shop.name,
      slug: shop.slug,
    });
  });

  it('wraps the orders of one checkout with their count', () => {
    const response = toPlacedOrdersResponse([detail, detail]);

    expect(response.ordersCount).toBe(2);
    expect(response.orders).toEqual([
      toOrderResponse(detail).order,
      toOrderResponse(detail).order,
    ]);
  });

  it('maps a page of summaries under the orders envelope', () => {
    expect(
      toOrdersResponse({
        summaries: [
          {
            order,
            shop: null,
            itemsCount: 1,
            firstItem: item,
            thumbnailUrl: null,
          },
        ],
        total: 9,
      }),
    ).toEqual({
      orders: [
        {
          code: 'ORD-20261005-0001',
          status: OrderStatus.Pending,
          paymentMethod: PaymentMethod.Cod,
          paymentStatus: PaymentStatus.Unpaid,
          total: 330000,
          shop: null,
          createdAt: CREATED_AT.toISOString(),
          itemsCount: 1,
          firstItemName: 'Áo thun',
          thumbnailUrl: null,
        },
      ],
      ordersCount: 9,
    });
  });
});
