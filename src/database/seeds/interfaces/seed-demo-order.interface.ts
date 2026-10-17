import { OrderStatus } from '../../../orders/enums/order-status.enum';
import { PaymentMethod } from '../../../orders/enums/payment-method.enum';

export interface SeedDemoOrder {
  status: OrderStatus;
  lines: number;
  paymentMethod: PaymentMethod;
  paid: boolean;
}
