import Stripe from 'stripe';

import { PaymentAttemptStatus } from '../enums/payment-attempt-status.enum';
import { PaymentProvider } from '../enums/payment-provider.enum';
import { InvalidWebhookError } from './invalid-webhook.error';
import {
  createStripeClient,
  StripePaymentGateway,
} from './stripe-payment.gateway';

describe('StripePaymentGateway', () => {
  const WEBHOOK_SECRET = 'whsec_test_secret';
  const stripe = new Stripe('sk_test_123');
  const gateway = new StripePaymentGateway(stripe, WEBHOOK_SECRET);

  const signed = (event: object) => {
    const payload = JSON.stringify(event);

    return {
      rawBody: Buffer.from(payload),
      signature: stripe.webhooks.generateTestHeaderString({
        payload,
        secret: WEBHOOK_SECRET,
      }),
    };
  };

  const intentEvent = (type: string, object: object = {}) => ({
    id: 'evt_1',
    object: 'event',
    type,
    data: { object: { id: 'pi_1', object: 'payment_intent', ...object } },
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('is the STRIPE provider', () => {
    expect(gateway.provider).toBe(PaymentProvider.Stripe);
  });

  describe('createStripeClient', () => {
    const client = (apiUrl: URL | null) =>
      createStripeClient({
        secretKey: 'sk_test_123',
        webhookSecret: WEBHOOK_SECRET,
        apiUrl,
      });

    it('points the SDK at stripe-mock when an API URL is set', () => {
      const sdk = client(new URL('http://stripe-mock:12111'));

      expect(sdk.getApiField('host')).toBe('stripe-mock');
      expect(sdk.getApiField('port')).toBe(12111);
      expect(sdk.getApiField('protocol')).toBe('http');
    });

    it('talks to the real API otherwise, with a timeout and one retry', () => {
      const sdk = client(null);

      expect(sdk.getApiField('host')).toBe('api.stripe.com');
      expect(sdk.getApiField('timeout')).toBe(10_000);
      expect(sdk.getMaxNetworkRetries()).toBe(1);
    });
  });

  describe('createIntent', () => {
    it('creates a VND intent, idempotent on the payment id', async () => {
      const create = jest
        .spyOn(stripe.paymentIntents, 'create')
        .mockResolvedValue({
          id: 'pi_1',
          client_secret: 'pi_1_secret_1',
        } as Stripe.Response<Stripe.PaymentIntent>);

      await expect(
        gateway.createIntent({
          paymentId: 'pay1',
          orderCode: 'ORD-20261110-0001',
          amount: 330000,
          currency: 'VND',
        }),
      ).resolves.toEqual({
        providerPaymentId: 'pi_1',
        clientSecret: 'pi_1_secret_1',
      });
      expect(create).toHaveBeenCalledWith(
        {
          amount: 330000,
          currency: 'vnd',
          automatic_payment_methods: { enabled: true },
          metadata: { paymentId: 'pay1', orderCode: 'ORD-20261110-0001' },
        },
        { idempotencyKey: 'pay1' },
      );
    });

    it('fails when Stripe returns no client secret', async () => {
      jest.spyOn(stripe.paymentIntents, 'create').mockResolvedValue({
        id: 'pi_1',
        client_secret: null,
      } as Stripe.Response<Stripe.PaymentIntent>);

      await expect(
        gateway.createIntent({
          paymentId: 'pay1',
          orderCode: 'ORD-20261110-0001',
          amount: 1,
          currency: 'VND',
        }),
      ).rejects.toThrow('without a client secret');
    });
  });

  describe('refund', () => {
    it('refunds the intent, idempotent on the payment id', async () => {
      const create = jest
        .spyOn(stripe.refunds, 'create')
        .mockResolvedValue({ id: 're_1' } as Stripe.Response<Stripe.Refund>);

      await expect(gateway.refund('pi_1', 'pay1')).resolves.toEqual({
        providerRefundId: 're_1',
      });
      expect(create).toHaveBeenCalledWith(
        { payment_intent: 'pi_1' },
        { idempotencyKey: 'refund-pay1' },
      );
    });
  });

  describe('parseEvent', () => {
    it('maps a success', () => {
      const event = intentEvent('payment_intent.succeeded');
      const { rawBody, signature } = signed(event);

      expect(gateway.parseEvent(rawBody, signature)).toEqual({
        id: 'evt_1',
        type: 'payment_intent.succeeded',
        providerPaymentId: 'pi_1',
        status: PaymentAttemptStatus.Succeeded,
        card: null,
        failure: null,
        payload: event,
      });
    });

    it('maps a decline with the card and the reason', () => {
      const { rawBody, signature } = signed(
        intentEvent('payment_intent.payment_failed', {
          last_payment_error: {
            type: 'card_error',
            code: 'card_declined',
            message: 'Your card was declined.',
            payment_method: { card: { brand: 'visa', last4: '0002' } },
          },
        }),
      );

      expect(gateway.parseEvent(rawBody, signature)).toMatchObject({
        status: PaymentAttemptStatus.Failed,
        card: { brand: 'visa', last4: '0002' },
        failure: { code: 'card_declined', message: 'Your card was declined.' },
      });
    });

    it('falls back on the error type when Stripe gives no code', () => {
      const { rawBody, signature } = signed(
        intentEvent('payment_intent.payment_failed', {
          last_payment_error: { type: 'api_error' },
        }),
      );

      expect(gateway.parseEvent(rawBody, signature).failure).toEqual({
        code: 'api_error',
        message: '',
      });
    });

    it('fails an attempt whose intent was canceled', () => {
      const { rawBody, signature } = signed(
        intentEvent('payment_intent.canceled'),
      );

      expect(gateway.parseEvent(rawBody, signature).status).toBe(
        PaymentAttemptStatus.Failed,
      );
    });

    it('leaves an unhandled intent event without a status', () => {
      const { rawBody, signature } = signed(
        intentEvent('payment_intent.created'),
      );

      expect(gateway.parseEvent(rawBody, signature).status).toBeNull();
    });

    it('acknowledges an event about another object', () => {
      const { rawBody, signature } = signed({
        id: 'evt_2',
        object: 'event',
        type: 'charge.refunded',
        data: { object: { id: 'ch_1', object: 'charge' } },
      });

      expect(gateway.parseEvent(rawBody, signature)).toMatchObject({
        id: 'evt_2',
        providerPaymentId: null,
        status: null,
      });
    });

    it('rejects a forged signature', () => {
      const { rawBody } = signed(intentEvent('payment_intent.succeeded'));

      expect(() => gateway.parseEvent(rawBody, 't=1,v1=forged')).toThrow(
        InvalidWebhookError,
      );
    });
  });
});
