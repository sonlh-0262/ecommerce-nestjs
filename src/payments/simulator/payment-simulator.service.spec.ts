import { ConflictException, NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';

import { PaymentProvider } from '../enums/payment-provider.enum';
import { PaymentGateway } from '../interfaces/payment-gateway.interface';
import { PaymentWebhooksService } from '../payment-webhooks.service';
import { MockIntentStatus } from './enums/mock-intent-status.enum';
import { MockIntent } from './interfaces/mock-intent.interface';
import { CardConfirmation } from './interfaces/simulator-input.interface';
import { MockIntentStore } from './mock-intent.store';
import { MockPaymentGateway } from './mock-payment.gateway';
import { MOCK_DECLINES } from './payment-simulator.constants';
import { PaymentSimulatorService } from './payment-simulator.service';

describe('PaymentSimulatorService', () => {
  const SECRET = 'mock_pi_1_secret_1';
  const SIGNED = { rawBody: Buffer.from('{}'), signature: 't=1,v1=a' };

  const intent = (overrides: Partial<MockIntent> = {}): MockIntent => ({
    id: 'mock_pi_1',
    clientSecret: SECRET,
    amount: 330000,
    currency: 'VND',
    orderCode: 'ORD-20261110-0001',
    status: MockIntentStatus.RequiresPaymentMethod,
    card: null,
    failure: null,
    refundId: null,
    ...overrides,
  });

  const card = (
    overrides: Partial<CardConfirmation> = {},
  ): CardConfirmation => ({
    clientSecret: SECRET,
    cardNumber: '4242424242424242',
    expMonth: 12,
    expYear: 2030,
    cvc: '123',
    ...overrides,
  });

  const active = { provider: PaymentProvider.Mock };
  const mock = { sign: jest.fn(() => SIGNED) };
  const store = {
    find: jest.fn(),
    save: jest.fn((value: MockIntent) => Promise.resolve(value)),
  };
  const webhooks = { receive: jest.fn() };
  const i18n = { t: jest.fn((key: string) => key) };

  const service = new PaymentSimulatorService(
    active as unknown as PaymentGateway,
    mock as unknown as MockPaymentGateway,
    store as unknown as MockIntentStore,
    webhooks as unknown as PaymentWebhooksService,
    i18n as unknown as I18nService,
  );

  beforeEach(() => {
    active.provider = PaymentProvider.Mock;
    store.find.mockResolvedValue(intent());
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  describe('confirm', () => {
    it.each([
      ['4242424242424242', MockIntentStatus.Succeeded, 'visa', null],
      ['5555555555554444', MockIntentStatus.Succeeded, 'mastercard', null],
      ['4000002500003155', MockIntentStatus.RequiresAction, 'visa', null],
      [
        '4000000000000002',
        MockIntentStatus.Failed,
        'visa',
        MOCK_DECLINES.cardDeclined,
      ],
      [
        '4000000000009995',
        MockIntentStatus.Failed,
        'visa',
        MOCK_DECLINES.insufficientFunds,
      ],
      [
        '4000000000000069',
        MockIntentStatus.Failed,
        'visa',
        MOCK_DECLINES.expiredCard,
      ],
      [
        '4000000000000127',
        MockIntentStatus.Failed,
        'visa',
        MOCK_DECLINES.incorrectCvc,
      ],
      [
        '4111111111111111',
        MockIntentStatus.Failed,
        'unknown',
        MOCK_DECLINES.cardDeclined,
      ],
    ])('card %s ends %s', async (cardNumber, status, brand, failure) => {
      const result = await service.confirm('mock_pi_1', card({ cardNumber }));

      expect(result).toEqual(
        intent({
          status,
          failure,
          card: { brand, last4: cardNumber.slice(-4) },
        }),
      );
      expect(store.save).toHaveBeenCalledWith(result);
    });

    it.each([
      ['4242424242424242', 'payment_intent.succeeded'],
      ['4000002500003155', 'payment_intent.requires_action'],
      ['4000000000000002', 'payment_intent.payment_failed'],
    ])(
      'delivers a signed webhook for %s before answering',
      async (cardNumber, type) => {
        const result = await service.confirm('mock_pi_1', card({ cardNumber }));

        expect(mock.sign).toHaveBeenCalledWith(result, type);
        expect(webhooks.receive).toHaveBeenCalledWith(
          PaymentProvider.Mock,
          SIGNED.rawBody,
          SIGNED.signature,
        );
      },
    );

    it('keeps the intent untouched when the webhook could not be applied', async () => {
      webhooks.receive.mockRejectedValueOnce(new Error('database is down'));

      await expect(service.confirm('mock_pi_1', card())).rejects.toThrow(
        'database is down',
      );
      expect(store.save).not.toHaveBeenCalled();
    });

    it('declines a card that expired last month, whatever its number', async () => {
      jest.useFakeTimers({ now: new Date('2026-11-10T03:00:00Z') });

      const result = await service.confirm(
        'mock_pi_1',
        card({ expMonth: 10, expYear: 2026 }),
      );

      expect(result.status).toBe(MockIntentStatus.Failed);
      expect(result.failure).toEqual(MOCK_DECLINES.expiredCard);
    });

    it('accepts a card expiring this month', async () => {
      jest.useFakeTimers({ now: new Date('2026-11-10T03:00:00Z') });

      const result = await service.confirm(
        'mock_pi_1',
        card({ expMonth: 11, expYear: 2026 }),
      );

      expect(result.status).toBe(MockIntentStatus.Succeeded);
    });

    it('answers 404 while another provider is configured', async () => {
      active.provider = PaymentProvider.Stripe;

      await expect(service.confirm('mock_pi_1', card())).rejects.toThrow(
        new NotFoundException('payments.SIMULATOR_DISABLED'),
      );
      expect(store.find).not.toHaveBeenCalled();
    });

    it.each([
      ['an unknown intent', null, SECRET],
      ['a wrong client secret', intent(), 'mock_pi_1_secret_2'],
      ['a client secret of another length', intent(), 'short'],
    ])('answers 404 for %s', async (_case, current, clientSecret) => {
      store.find.mockResolvedValue(current);

      await expect(
        service.confirm('mock_pi_1', card({ clientSecret })),
      ).rejects.toThrow(new NotFoundException('payments.INTENT_NOT_FOUND'));
    });

    it('answers 409 when the intent was already confirmed', async () => {
      store.find.mockResolvedValue(
        intent({ status: MockIntentStatus.Succeeded }),
      );

      await expect(service.confirm('mock_pi_1', card())).rejects.toThrow(
        ConflictException,
      );
      expect(i18n.t).toHaveBeenCalledWith('payments.INTENT_NOT_AWAITING', {
        args: { status: MockIntentStatus.Succeeded },
      });
      expect(webhooks.receive).not.toHaveBeenCalled();
    });
  });

  describe('authenticate', () => {
    const challenged = intent({
      status: MockIntentStatus.RequiresAction,
      card: { brand: 'visa', last4: '3155' },
    });

    beforeEach(() => {
      store.find.mockResolvedValue(challenged);
    });

    it('succeeds when the cardholder approves', async () => {
      const result = await service.authenticate('mock_pi_1', {
        clientSecret: SECRET,
        approve: true,
      });

      expect(result).toEqual({
        ...challenged,
        status: MockIntentStatus.Succeeded,
      });
      expect(mock.sign).toHaveBeenCalledWith(
        result,
        'payment_intent.succeeded',
      );
    });

    it('fails when the cardholder does not', async () => {
      const result = await service.authenticate('mock_pi_1', {
        clientSecret: SECRET,
        approve: false,
      });

      expect(result).toEqual({
        ...challenged,
        status: MockIntentStatus.Failed,
        failure: MOCK_DECLINES.authenticationFailed,
      });
      expect(mock.sign).toHaveBeenCalledWith(
        result,
        'payment_intent.payment_failed',
      );
    });

    it('answers 409 for an intent that never asked for 3D Secure', async () => {
      store.find.mockResolvedValue(intent());

      await expect(
        service.authenticate('mock_pi_1', {
          clientSecret: SECRET,
          approve: true,
        }),
      ).rejects.toThrow(ConflictException);
    });
  });
});
