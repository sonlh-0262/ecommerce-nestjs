import { OrderItem } from '../entities/order-item.entity';
import { OrderStatusHistory } from '../entities/order-status-history.entity';
import { Order } from '../entities/order.entity';
import { OrderStatus } from '../enums/order-status.enum';
import { PaymentMethod } from '../enums/payment-method.enum';
import { PaymentStatus } from '../enums/payment-status.enum';
import { OrderUser } from '../interfaces/admin-order.interface';
import { toAdminOrderResponse, toAdminOrdersResponse } from './admin-order.dto';

describe('admin order mappers', () => {
  const CREATED_AT = new Date('2026-10-05T03:00:00.000Z');
  const CUSTOMER: OrderUser = {
    id: 'u1',
    email: 'son@example.com',
    username: 'sonlh',
    fullName: 'Lanh Hung Son',
  };
  const ADMIN: OrderUser = {
    id: 'a1',
    email: 'admin@example.com',
    username: 'admin',
    fullName: null,
  };

  const order = {
    id: 'o1',
    code: 'ORD-20261005-0001',
    userId: CUSTOMER.id,
    status: OrderStatus.Confirmed,
    paymentMethod: PaymentMethod.Cod,
    paymentStatus: PaymentStatus.Unpaid,
    paidAt: null,
    total: 330000,
    deliveredAt: null,
    createdAt: CREATED_AT,
  } as Order;

  const entry = (
    toStatus: OrderStatus,
    changedBy: string | null,
  ): OrderStatusHistory =>
    ({
      fromStatus: null,
      toStatus,
      reason: null,
      changedBy,
      createdAt: CREATED_AT,
    }) as OrderStatusHistory;

  it('adds the customer and who made each change', () => {
    const response = toAdminOrderResponse({
      order,
      items: [],
      history: [
        entry(OrderStatus.Pending, CUSTOMER.id),
        entry(OrderStatus.Confirmed, ADMIN.id),
        entry(OrderStatus.Confirmed, 'gone'),
        entry(OrderStatus.Confirmed, null),
      ],
      thumbnailUrls: new Map(),
      customer: CUSTOMER,
      actors: new Map([
        [CUSTOMER.id, CUSTOMER],
        [ADMIN.id, ADMIN],
      ]),
    });

    expect(response.order.user).toEqual(CUSTOMER);
    expect(response.order.code).toBe('ORD-20261005-0001');
    expect(
      response.order.statusHistory.map(({ changedBy }) => changedBy),
    ).toEqual([CUSTOMER, ADMIN, null, null]);
  });

  it('adds the customer to each summary of a page', () => {
    const response = toAdminOrdersResponse({
      summaries: [
        {
          order,
          itemsCount: 1,
          firstItem: { productName: 'Áo thun' } as OrderItem,
          thumbnailUrl: null,
          customer: CUSTOMER,
        },
      ],
      total: 4,
    });

    expect(response).toEqual({
      orders: [
        {
          code: 'ORD-20261005-0001',
          status: OrderStatus.Confirmed,
          paymentMethod: PaymentMethod.Cod,
          paymentStatus: PaymentStatus.Unpaid,
          total: 330000,
          createdAt: CREATED_AT.toISOString(),
          itemsCount: 1,
          firstItemName: 'Áo thun',
          thumbnailUrl: null,
          user: CUSTOMER,
        },
      ],
      ordersCount: 4,
    });
  });
});
