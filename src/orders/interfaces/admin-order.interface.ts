import { User } from '../../users/entities/user.entity';
import { OrderDetail } from './order-detail.interface';
import { OrderSummary } from './order-summary.interface';

export type OrderUser = Pick<User, 'id' | 'email' | 'username' | 'fullName'>;

export interface AdminOrderDetail extends OrderDetail {
  customer: OrderUser;
  actors: Map<string, OrderUser>;
}

export interface AdminOrderSummary extends OrderSummary {
  customer: OrderUser;
}

export interface AdminOrderPage {
  summaries: AdminOrderSummary[];
  total: number;
}
