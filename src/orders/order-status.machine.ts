import { OrderStatus } from './enums/order-status.enum';

export const ORDER_TRANSITIONS: Readonly<
  Record<OrderStatus, readonly OrderStatus[]>
> = {
  [OrderStatus.Pending]: [
    OrderStatus.Confirmed,
    OrderStatus.Rejected,
    OrderStatus.Cancelled,
  ],
  [OrderStatus.Confirmed]: [OrderStatus.Shipping],
  [OrderStatus.Shipping]: [OrderStatus.Delivered],
  [OrderStatus.Delivered]: [],
  [OrderStatus.Cancelled]: [],
  [OrderStatus.Rejected]: [],
};

const REASON_REQUIRED_STATUSES: readonly OrderStatus[] = [OrderStatus.Rejected];

const STOCK_RESTORING_STATUSES: readonly OrderStatus[] = [
  OrderStatus.Cancelled,
  OrderStatus.Rejected,
];

const CUSTOMER_NOTIFIED_STATUSES: readonly OrderStatus[] = [
  OrderStatus.Confirmed,
  OrderStatus.Rejected,
];

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from].includes(to);
}

export function requiresReason(to: OrderStatus): boolean {
  return REASON_REQUIRED_STATUSES.includes(to);
}

export function restoresStock(to: OrderStatus): boolean {
  return STOCK_RESTORING_STATUSES.includes(to);
}

export function isFinal(status: OrderStatus): boolean {
  return ORDER_TRANSITIONS[status].length === 0;
}

export function completesDelivery(to: OrderStatus): boolean {
  return to === OrderStatus.Delivered;
}

export function notifiesCustomer(to: OrderStatus): boolean {
  return CUSTOMER_NOTIFIED_STATUSES.includes(to);
}
