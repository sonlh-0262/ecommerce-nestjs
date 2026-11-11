import { registerAs } from '@nestjs/config';

import { PaymentProvider } from '../payments/enums/payment-provider.enum';
import {
  DEFAULT_MOCK_PAYMENT_WEBHOOK_SECRET,
  DEFAULT_PAYMENT_PROVIDER,
  MOCK_PAYMENT_PROVIDER,
  STRIPE_PAYMENT_PROVIDER,
} from './config.constants';

export interface StripeConfig {
  secretKey: string;
  webhookSecret: string;
  apiUrl: URL | null;
}

export interface PaymentsConfig {
  provider: PaymentProvider;
  mockWebhookSecret: string;
  stripe: StripeConfig;
}

export const PAYMENTS_CONFIG_KEY = 'payments';

const PROVIDERS: Readonly<Record<string, PaymentProvider>> = {
  [MOCK_PAYMENT_PROVIDER]: PaymentProvider.Mock,
  [STRIPE_PAYMENT_PROVIDER]: PaymentProvider.Stripe,
};

export default registerAs(PAYMENTS_CONFIG_KEY, (): PaymentsConfig => ({
  provider: PROVIDERS[process.env.PAYMENT_PROVIDER ?? DEFAULT_PAYMENT_PROVIDER],
  mockWebhookSecret:
    process.env.MOCK_PAYMENT_WEBHOOK_SECRET ??
    DEFAULT_MOCK_PAYMENT_WEBHOOK_SECRET,
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY ?? '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? '',
    apiUrl: process.env.STRIPE_API_URL
      ? new URL(process.env.STRIPE_API_URL)
      : null,
  },
}));
