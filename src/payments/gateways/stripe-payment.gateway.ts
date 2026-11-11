import Stripe from 'stripe';

import { StripeConfig } from '../../config/payments.config';
import { PaymentProvider } from '../enums/payment-provider.enum';
import {
  CreateIntentInput,
  GatewayEvent,
  GatewayIntent,
  GatewayRefund,
  PaymentGateway,
} from '../interfaces/payment-gateway.interface';
import {
  GATEWAY_EVENT_STATUSES,
  PAYMENT_GATEWAY_MAX_RETRIES,
  PAYMENT_GATEWAY_TIMEOUT_MS,
  PAYMENT_INTENT_OBJECT,
  REFUND_KEY_PREFIX,
  WEBHOOK_TOLERANCE_SECONDS,
} from '../payments.constants';
import { InvalidWebhookError } from './invalid-webhook.error';

export function createStripeClient({
  secretKey,
  apiUrl,
}: StripeConfig): Stripe {
  return new Stripe(secretKey, {
    timeout: PAYMENT_GATEWAY_TIMEOUT_MS,
    maxNetworkRetries: PAYMENT_GATEWAY_MAX_RETRIES,
    ...(apiUrl && {
      host: apiUrl.hostname,
      port: Number(apiUrl.port),
      protocol: apiUrl.protocol === 'http:' ? 'http' : 'https',
    }),
  });
}

export class StripePaymentGateway implements PaymentGateway {
  readonly provider = PaymentProvider.Stripe;

  constructor(
    private readonly stripe: Stripe,
    private readonly webhookSecret: string,
  ) {}

  async createIntent({
    paymentId,
    orderCode,
    amount,
    currency,
  }: CreateIntentInput): Promise<GatewayIntent> {
    const intent = await this.stripe.paymentIntents.create(
      {
        amount,
        currency: currency.toLowerCase(),
        automatic_payment_methods: { enabled: true },
        metadata: { paymentId, orderCode },
      },
      { idempotencyKey: paymentId },
    );

    if (!intent.client_secret) {
      throw new Error(`Stripe returned ${intent.id} without a client secret`);
    }

    return { providerPaymentId: intent.id, clientSecret: intent.client_secret };
  }

  async refund(
    providerPaymentId: string,
    paymentId: string,
  ): Promise<GatewayRefund> {
    const refund = await this.stripe.refunds.create(
      { payment_intent: providerPaymentId },
      { idempotencyKey: `${REFUND_KEY_PREFIX}${paymentId}` },
    );

    return { providerRefundId: refund.id };
  }

  parseEvent(rawBody: Buffer, signature: string): GatewayEvent {
    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        this.webhookSecret,
        WEBHOOK_TOLERANCE_SECONDS,
      );
    } catch (error) {
      throw new InvalidWebhookError(
        error instanceof Error ? error.message : String(error),
      );
    }

    const base = {
      id: event.id,
      type: event.type,
      payload: event,
    };

    if (event.data.object.object !== PAYMENT_INTENT_OBJECT) {
      return {
        ...base,
        providerPaymentId: null,
        status: null,
        card: null,
        failure: null,
      };
    }

    const intent = event.data.object;
    const error = intent.last_payment_error;
    const card = error?.payment_method?.card;

    return {
      ...base,
      providerPaymentId: intent.id,
      status: GATEWAY_EVENT_STATUSES[event.type] ?? null,
      card: card ? { brand: card.brand, last4: card.last4 } : null,
      failure: error
        ? { code: error.code ?? error.type, message: error.message ?? '' }
        : null,
    };
  }
}
