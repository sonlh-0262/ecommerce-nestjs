import { UserRef } from '../../users/dto/user-ref.dto';
import { OrderDetail } from './order-detail.interface';
import { OrderSummary } from './order-summary.interface';

export interface AdminOrderDetail extends OrderDetail {
  customer: UserRef;
  actors: Map<string, UserRef>;
}

export interface AdminOrderSummary extends OrderSummary {
  customer: UserRef;
}

export interface AdminOrderPage {
  summaries: AdminOrderSummary[];
  total: number;
}
