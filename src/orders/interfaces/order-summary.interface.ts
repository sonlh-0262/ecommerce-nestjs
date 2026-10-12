import { OrderItem } from '../entities/order-item.entity';
import { Order } from '../entities/order.entity';

export interface OrderSummary {
  order: Order;
  itemsCount: number;
  firstItem: OrderItem | null;
  thumbnailUrl: string | null;
}

export interface OrderPage {
  summaries: OrderSummary[];
  total: number;
}
