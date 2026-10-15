import { Order } from '../entities/order.entity';
import { OrderStatus } from '../enums/order-status.enum';

export interface OrderStatusChange {
  to: OrderStatus;
  changedBy: string;
  reason?: string | null;
  patch?: Partial<Order>;
}
