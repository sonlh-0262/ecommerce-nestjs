import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  PAYMENTS_CONFIG_KEY,
  PaymentsConfig,
} from '../../config/payments.config';
import { PaymentProvider } from '../enums/payment-provider.enum';
import { PaymentGateway } from '../interfaces/payment-gateway.interface';
import { PAYMENT_GATEWAY } from '../payments.constants';
import { MockPaymentGateway } from '../simulator/mock-payment.gateway';
import {
  createStripeClient,
  StripePaymentGateway,
} from './stripe-payment.gateway';

export const paymentGatewayProvider: Provider<PaymentGateway> = {
  provide: PAYMENT_GATEWAY,
  inject: [ConfigService, MockPaymentGateway],
  useFactory: (
    configService: ConfigService,
    mock: MockPaymentGateway,
  ): PaymentGateway => {
    const { provider, stripe } =
      configService.getOrThrow<PaymentsConfig>(PAYMENTS_CONFIG_KEY);

    return provider === PaymentProvider.Stripe
      ? new StripePaymentGateway(
          createStripeClient(stripe),
          stripe.webhookSecret,
        )
      : mock;
  },
};
