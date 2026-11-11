import { PaymentAttemptStatus } from '../enums/payment-attempt-status.enum';
import { PaymentProvider } from '../enums/payment-provider.enum';

export interface CreateIntentInput {
  paymentId: string;
  orderCode: string;
  amount: number;
  currency: string;
}

export interface GatewayIntent {
  providerPaymentId: string;
  clientSecret: string;
}

export interface GatewayRefund {
  providerRefundId: string;
}

export interface GatewayCard {
  brand: string;
  last4: string;
}

export interface GatewayFailure {
  code: string;
  message: string;
}

export interface GatewayEvent {
  id: string;
  type: string;
  providerPaymentId: string | null;
  status: PaymentAttemptStatus | null;
  card: GatewayCard | null;
  failure: GatewayFailure | null;
  payload: object;
}

export interface PaymentGateway {
  readonly provider: PaymentProvider;
  createIntent(input: CreateIntentInput): Promise<GatewayIntent>;
  refund(providerPaymentId: string, paymentId: string): Promise<GatewayRefund>;
  parseEvent(rawBody: Buffer, signature: string): GatewayEvent;
}
