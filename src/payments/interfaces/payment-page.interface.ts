import { Payment } from '../entities/payment.entity';

export interface PaymentPage {
  payments: Payment[];
  total: number;
}
