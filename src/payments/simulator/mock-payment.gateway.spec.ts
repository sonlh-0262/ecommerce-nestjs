import { ConfigService } from '@nestjs/config';

import { PaymentAttemptStatus } from '../enums/payment-attempt-status.enum';
import { PaymentProvider } from '../enums/payment-provider.enum';
import { InvalidWebhookError } from '../gateways/invalid-webhook.error';
import { MockIntentStatus } from './enums/mock-intent-status.enum';
import { MockIntent } from './interfaces/mock-intent.interface';
import { MockIntentStore } from './mock-intent.store';
import { MockPaymentGateway } from './mock-payment.gateway';
import { signWebhook } from './webhook-signature';

describe('MockPaymentGateway', () => {
  const SECRET = 'mock-payment-webhook-secret-for-tests';
  const intent = (overrides: Partial<MockIntent> = {}): MockIntent => ({
    id: 'mock_pi_1',
    clientSecret: 'mock_pi_1_secret_1',
    amount: 330000,
    currency: 'VND',
    orderCode: 'ORD-20261110-0001',
    status: MockIntentStatus.Succeeded,
    card: { brand: 'visa', last4: '4242' },
    failure: null,
    refundId: null,
    ...overrides,
  });

  const store = {
    find: jest.fn(),
    save: jest.fn((value: MockIntent) => Promise.resolve(value)),
  };
  const config = {
    getOrThrow: jest.fn(() => ({ mockWebhookSecret: SECRET })),
  };
  const gateway = new MockPaymentGateway(
    store as unknown as MockIntentStore,
    config as unknown as ConfigService,
  );

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('is the MOCK provider', () => {
    expect(gateway.provider).toBe(PaymentProvider.Mock);
  });

  describe('createIntent', () => {
    it('stores an intent awaiting a card and returns its secret', async () => {
      const created = await gateway.createIntent({
        paymentId: 'pay1',
        orderCode: 'ORD-20261110-0001',
        amount: 330000,
        currency: 'VND',
      });

      expect(created.providerPaymentId).toMatch(/^mock_pi_[0-9a-f]{24}$/);
      expect(created.clientSecret).toMatch(
        new RegExp(`^${created.providerPaymentId}_secret_[0-9a-f]{32}$`),
      );
      expect(store.save).toHaveBeenCalledWith({
        id: created.providerPaymentId,
        clientSecret: created.clientSecret,
        amount: 330000,
        currency: 'VND',
        orderCode: 'ORD-20261110-0001',
        status: MockIntentStatus.RequiresPaymentMethod,
        card: null,
        failure: null,
        refundId: null,
      });
    });
  });

  describe('refund', () => {
    it('refunds a successful intent', async () => {
      store.find.mockResolvedValue(intent());

      const { providerRefundId } = await gateway.refund('mock_pi_1');

      expect(providerRefundId).toMatch(/^mock_re_[0-9a-f]{24}$/);
      expect(store.save).toHaveBeenCalledWith(
        intent({
          status: MockIntentStatus.Refunded,
          refundId: providerRefundId,
        }),
      );
    });

    it('returns the same refund when asked twice', async () => {
      store.find.mockResolvedValue(
        intent({ status: MockIntentStatus.Refunded, refundId: 'mock_re_1' }),
      );

      await expect(gateway.refund('mock_pi_1')).resolves.toEqual({
        providerRefundId: 'mock_re_1',
      });
      expect(store.save).not.toHaveBeenCalled();
    });

    it.each([
      [null, 'missing'],
      [intent({ status: MockIntentStatus.Failed }), MockIntentStatus.Failed],
    ])('refuses to refund %p', async (current, label) => {
      store.find.mockResolvedValue(current);

      await expect(gateway.refund('mock_pi_1')).rejects.toThrow(label);
    });
  });

  describe('sign + parseEvent', () => {
    it('round-trips an event into a gateway event', () => {
      const { rawBody, signature } = gateway.sign(
        intent(),
        'payment_intent.succeeded',
      );
      const event = gateway.parseEvent(rawBody, signature);

      expect(event).toEqual({
        id: expect.stringMatching(/^mock_evt_/) as string,
        type: 'payment_intent.succeeded',
        providerPaymentId: 'mock_pi_1',
        status: PaymentAttemptStatus.Succeeded,
        card: { brand: 'visa', last4: '4242' },
        failure: null,
        payload: JSON.parse(rawBody.toString()) as object,
      });
    });

    it('maps a decline with its reason', () => {
      const failure = { code: 'card_declined', message: 'Declined.' };
      const { rawBody, signature } = gateway.sign(
        intent({ status: MockIntentStatus.Failed, failure }),
        'payment_intent.payment_failed',
      );

      expect(gateway.parseEvent(rawBody, signature)).toMatchObject({
        status: PaymentAttemptStatus.Failed,
        failure,
      });
    });

    it('leaves an unknown event type without a status', () => {
      const { rawBody, signature } = gateway.sign(intent(), 'charge.updated');

      expect(gateway.parseEvent(rawBody, signature).status).toBeNull();
    });

    it('rejects a body signed with another secret', () => {
      const { rawBody } = gateway.sign(intent(), 'payment_intent.succeeded');
      const forged = signWebhook(
        rawBody.toString(),
        'another-secret-entirely',
        Math.floor(Date.now() / 1000),
      );

      expect(() => gateway.parseEvent(rawBody, forged)).toThrow(
        InvalidWebhookError,
      );
    });

    it.each(['not json', '{"id":1}', '{"id":"e","type":"t","data":{}}'])(
      'rejects the correctly signed body %p',
      (body) => {
        const signature = signWebhook(
          body,
          SECRET,
          Math.floor(Date.now() / 1000),
        );

        expect(() => gateway.parseEvent(Buffer.from(body), signature)).toThrow(
          InvalidWebhookError,
        );
      },
    );

    it('defaults a missing card and error to null', () => {
      const body = JSON.stringify({
        id: 'mock_evt_1',
        type: 'payment_intent.requires_action',
        created: 1,
        data: { object: { id: 'mock_pi_1', amount: 1, currency: 'VND' } },
      });
      const signature = signWebhook(
        body,
        SECRET,
        Math.floor(Date.now() / 1000),
      );

      expect(gateway.parseEvent(Buffer.from(body), signature)).toMatchObject({
        status: PaymentAttemptStatus.RequiresAction,
        card: null,
        failure: null,
      });
    });
  });
});
