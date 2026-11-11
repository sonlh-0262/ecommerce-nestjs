import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';

import {
  PAYMENTS_CONFIG_KEY,
  PaymentsConfig,
} from '../../config/payments.config';
import { PaymentProvider } from '../enums/payment-provider.enum';
import { InvalidWebhookError } from '../gateways/invalid-webhook.error';
import {
  CreateIntentInput,
  GatewayEvent,
  GatewayIntent,
  GatewayRefund,
  PaymentGateway,
} from '../interfaces/payment-gateway.interface';
import {
  GATEWAY_EVENT_STATUSES,
  WEBHOOK_TOLERANCE_SECONDS,
} from '../payments.constants';
import { MockIntentStatus } from './enums/mock-intent-status.enum';
import {
  MockIntent,
  MockWebhookEvent,
} from './interfaces/mock-intent.interface';
import { MockIntentStore } from './mock-intent.store';
import {
  MOCK_EVENT_ID_PREFIX,
  MOCK_ID_BYTES,
  MOCK_INTENT_ID_PREFIX,
  MOCK_REFUND_ID_PREFIX,
  MOCK_SECRET_BYTES,
  MOCK_SECRET_INFIX,
} from './payment-simulator.constants';
import { isValidWebhookSignature, signWebhook } from './webhook-signature';

export interface SignedWebhook {
  rawBody: Buffer;
  signature: string;
}

@Injectable()
export class MockPaymentGateway implements PaymentGateway {
  readonly provider = PaymentProvider.Mock;
  private readonly secret: string;

  constructor(
    private readonly store: MockIntentStore,
    configService: ConfigService,
  ) {
    this.secret =
      configService.getOrThrow<PaymentsConfig>(
        PAYMENTS_CONFIG_KEY,
      ).mockWebhookSecret;
  }

  async createIntent({
    amount,
    currency,
    orderCode,
  }: CreateIntentInput): Promise<GatewayIntent> {
    const id = `${MOCK_INTENT_ID_PREFIX}${randomHex(MOCK_ID_BYTES)}`;
    const intent = await this.store.save({
      id,
      clientSecret: `${id}${MOCK_SECRET_INFIX}${randomHex(MOCK_SECRET_BYTES)}`,
      amount,
      currency,
      orderCode,
      status: MockIntentStatus.RequiresPaymentMethod,
      card: null,
      failure: null,
      refundId: null,
    });

    return { providerPaymentId: intent.id, clientSecret: intent.clientSecret };
  }

  async refund(providerPaymentId: string): Promise<GatewayRefund> {
    const intent = await this.store.find(providerPaymentId);

    if (intent?.status === MockIntentStatus.Refunded && intent.refundId) {
      return { providerRefundId: intent.refundId };
    }

    if (intent?.status !== MockIntentStatus.Succeeded) {
      throw new Error(
        `Mock intent ${providerPaymentId} cannot be refunded (${intent?.status ?? 'missing'})`,
      );
    }

    const refunded = await this.store.save({
      ...intent,
      status: MockIntentStatus.Refunded,
      refundId: `${MOCK_REFUND_ID_PREFIX}${randomHex(MOCK_ID_BYTES)}`,
    });

    return { providerRefundId: refunded.refundId as string };
  }

  parseEvent(rawBody: Buffer, signature: string): GatewayEvent {
    const payload = rawBody.toString('utf8');

    if (
      !isValidWebhookSignature(
        payload,
        signature,
        this.secret,
        nowSeconds(),
        WEBHOOK_TOLERANCE_SECONDS,
      )
    ) {
      throw new InvalidWebhookError('signature mismatch');
    }

    const event = parseMockEvent(payload);
    const intent = event.data.object;

    return {
      id: event.id,
      type: event.type,
      providerPaymentId: intent.id,
      status: GATEWAY_EVENT_STATUSES[event.type] ?? null,
      card: intent.card,
      failure: intent.last_payment_error,
      payload: event,
    };
  }

  sign(intent: MockIntent, type: string): SignedWebhook {
    const created = nowSeconds();
    const event: MockWebhookEvent = {
      id: `${MOCK_EVENT_ID_PREFIX}${randomHex(MOCK_ID_BYTES)}`,
      type,
      created,
      data: {
        object: {
          id: intent.id,
          amount: intent.amount,
          currency: intent.currency,
          card: intent.card,
          last_payment_error: intent.failure,
        },
      },
    };
    const payload = JSON.stringify(event);

    return {
      rawBody: Buffer.from(payload),
      signature: signWebhook(payload, this.secret, created),
    };
  }
}

function parseMockEvent(payload: string): MockWebhookEvent {
  let event: Partial<MockWebhookEvent> | null;

  try {
    event = JSON.parse(payload) as Partial<MockWebhookEvent> | null;
  } catch {
    throw new InvalidWebhookError('body is not JSON');
  }

  if (
    typeof event?.id !== 'string' ||
    typeof event.type !== 'string' ||
    typeof event.data?.object?.id !== 'string'
  ) {
    throw new InvalidWebhookError('body is not a payment intent event');
  }

  return {
    ...event,
    data: {
      object: {
        ...event.data.object,
        card: event.data.object.card ?? null,
        last_payment_error: event.data.object.last_payment_error ?? null,
      },
    },
  } as MockWebhookEvent;
}

function randomHex(bytes: number): string {
  return randomBytes(bytes).toString('hex');
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}
