import { Order } from '../entities/order.entity';
import { OrderStatus } from '../enums/order-status.enum';

export interface OrderStatusChange {
  to: OrderStatus;
  changedBy: string | null;
  reason?: string | null;
  patch?: Partial<Order>;
}
