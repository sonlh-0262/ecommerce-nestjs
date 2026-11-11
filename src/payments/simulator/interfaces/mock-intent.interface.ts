import {
  GatewayCard,
  GatewayFailure,
} from '../../interfaces/payment-gateway.interface';
import { MockIntentStatus } from '../enums/mock-intent-status.enum';

export interface MockIntent {
  id: string;
  clientSecret: string;
  amount: number;
  currency: string;
  orderCode: string;
  status: MockIntentStatus;
  card: GatewayCard | null;
  failure: GatewayFailure | null;
  refundId: string | null;
}

export interface MockWebhookEvent {
  id: string;
  type: string;
  created: number;
  data: {
    object: {
      id: string;
      amount: number;
      currency: string;
      card: GatewayCard | null;
      last_payment_error: GatewayFailure | null;
    };
  };
}
