import { OrderStatus } from './enums/order-status.enum';
import {
  canTransition,
  completesDelivery,
  isFinal,
  notifiesCustomer,
  requiresReason,
  restoresStock,
} from './order-status.machine';

describe('order status machine', () => {
  const STATUSES = Object.values(OrderStatus);

  const ALLOWED = new Set([
    `${OrderStatus.Pending}>${OrderStatus.Confirmed}`,
    `${OrderStatus.Pending}>${OrderStatus.Rejected}`,
    `${OrderStatus.Pending}>${OrderStatus.Cancelled}`,
    `${OrderStatus.Confirmed}>${OrderStatus.Shipping}`,
    `${OrderStatus.Shipping}>${OrderStatus.Delivered}`,
  ]);

  const PAIRS = STATUSES.flatMap((from) =>
    STATUSES.map((to) => ({ from, to, allowed: ALLOWED.has(`${from}>${to}`) })),
  );

  const only =
    (...statuses: OrderStatus[]) =>
    (status: OrderStatus) => ({ status, expected: statuses.includes(status) });

  it('covers every one of the 36 pairs', () => {
    expect(PAIRS).toHaveLength(36);
  });

  it.each(PAIRS)(
    'canTransition($from, $to) is $allowed',
    ({ from, to, allowed }) => {
      expect(canTransition(from, to)).toBe(allowed);
    },
  );

  it.each(STATUSES.map(only(OrderStatus.Rejected)))(
    'requiresReason($status) is $expected',
    ({ status, expected }) => {
      expect(requiresReason(status)).toBe(expected);
    },
  );

  it.each(STATUSES.map(only(OrderStatus.Cancelled, OrderStatus.Rejected)))(
    'restoresStock($status) is $expected',
    ({ status, expected }) => {
      expect(restoresStock(status)).toBe(expected);
    },
  );

  it.each(
    STATUSES.map(
      only(OrderStatus.Delivered, OrderStatus.Cancelled, OrderStatus.Rejected),
    ),
  )('isFinal($status) is $expected', ({ status, expected }) => {
    expect(isFinal(status)).toBe(expected);
  });

  it.each(STATUSES.map(only(OrderStatus.Delivered)))(
    'completesDelivery($status) is $expected',
    ({ status, expected }) => {
      expect(completesDelivery(status)).toBe(expected);
    },
  );

  it.each(STATUSES.map(only(OrderStatus.Confirmed, OrderStatus.Rejected)))(
    'notifiesCustomer($status) is $expected',
    ({ status, expected }) => {
      expect(notifiesCustomer(status)).toBe(expected);
    },
  );
});
