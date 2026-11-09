import { Shop } from '../../shops/entities/shop.entity';
import { OrderItem } from '../entities/order-item.entity';
import { OrderStatusHistory } from '../entities/order-status-history.entity';
import { Order } from '../entities/order.entity';

export interface OrderDetail {
  order: Order;
  shop: Shop | null;
  items: OrderItem[];
  history: OrderStatusHistory[];
  thumbnailUrls: Map<string, string>;
}
