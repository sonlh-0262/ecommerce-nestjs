import { ConfigService } from '@nestjs/config';

import { PaymentsConfig } from '../../config/payments.config';
import { PaymentProvider } from '../enums/payment-provider.enum';
import { PaymentGateway } from '../interfaces/payment-gateway.interface';
import { MockPaymentGateway } from '../simulator/mock-payment.gateway';
import { paymentGatewayProvider } from './payment-gateway.provider';
import { StripePaymentGateway } from './stripe-payment.gateway';

describe('paymentGatewayProvider', () => {
  const mock = { provider: PaymentProvider.Mock } as MockPaymentGateway;

  const build = (provider: PaymentProvider): PaymentGateway => {
    const config: PaymentsConfig = {
      provider,
      mockWebhookSecret: 'mock-payment-webhook-secret',
      stripe: {
        secretKey: 'sk_test_123',
        webhookSecret: 'whsec_123',
        apiUrl: null,
      },
    };
    const configService = {
      getOrThrow: () => config,
    } as unknown as ConfigService;
    const { useFactory } = paymentGatewayProvider as {
      useFactory: (c: ConfigService, m: MockPaymentGateway) => PaymentGateway;
    };

    return useFactory(configService, mock);
  };

  it('uses the simulator when PAYMENT_PROVIDER=mock', () => {
    expect(build(PaymentProvider.Mock)).toBe(mock);
  });

  it('builds the Stripe gateway when PAYMENT_PROVIDER=stripe', () => {
    expect(build(PaymentProvider.Stripe)).toBeInstanceOf(StripePaymentGateway);
  });
});
