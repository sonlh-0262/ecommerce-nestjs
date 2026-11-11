import { BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { EntityManager } from 'typeorm';

import { transactionalDataSource } from '../database/transaction.fixture';
import { Order } from '../orders/entities/order.entity';
import { OrderStatus } from '../orders/enums/order-status.enum';
import { PaymentStatus } from '../orders/enums/payment-status.enum';
import { PaymentEvent } from './entities/payment-event.entity';
import { Payment } from './entities/payment.entity';
import { PaymentAttemptStatus } from './enums/payment-attempt-status.enum';
import { PaymentProvider } from './enums/payment-provider.enum';
import { InvalidWebhookError } from './gateways/invalid-webhook.error';
import {
  GatewayEvent,
  PaymentGateway,
} from './interfaces/payment-gateway.interface';
import { PaymentRefundsService } from './payment-refunds.service';
import { PaymentWebhooksService } from './payment-webhooks.service';

describe('PaymentWebhooksService', () => {
  const RAW = Buffer.from('{}');
  const SIGNATURE = 't=1,v1=abc';

  const event = (overrides: Partial<GatewayEvent> = {}): GatewayEvent => ({
    id: 'evt_1',
    type: 'payment_intent.succeeded',
    providerPaymentId: 'mock_pi_1',
    status: PaymentAttemptStatus.Succeeded,
    card: { brand: 'visa', last4: '4242' },
    failure: null,
    payload: { id: 'evt_1' },
    ...overrides,
  });

  const order = (overrides: Partial<Order> = {}): Order =>
    ({
      id: 'o1',
      code: 'ORD-20261110-0001',
      status: OrderStatus.Pending,
      paymentStatus: PaymentStatus.Unpaid,
      ...overrides,
    }) as Order;

  const payment = (status = PaymentAttemptStatus.Pending): Payment =>
    ({ id: 'pay1', orderId: 'o1', status }) as Payment;

  const queryBuilder = {
    insert: jest.fn().mockReturnThis(),
    into: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    orIgnore: jest.fn().mockReturnThis(),
    returning: jest.fn().mockReturnThis(),
    execute: jest.fn(),
  };
  const managerMock = {
    createQueryBuilder: jest.fn(() => queryBuilder),
    findOne: jest.fn(),
    update: jest.fn(),
  };
  const manager = managerMock as unknown as EntityManager;
  const { dataSource } = transactionalDataSource(manager);
  const gateway = { provider: PaymentProvider.Mock, parseEvent: jest.fn() };
  const refunds = { refund: jest.fn() };
  const i18n = { t: jest.fn((key: string) => key) };

  const service = new PaymentWebhooksService(
    dataSource,
    gateway as unknown as PaymentGateway,
    refunds as unknown as PaymentRefundsService,
    i18n as unknown as I18nService,
  );

  const receive = () => service.receive(PaymentProvider.Mock, RAW, SIGNATURE);

  const stored = (current: Payment, locked: Order) =>
    managerMock.findOne
      .mockResolvedValueOnce({ id: current.id, orderId: current.orderId })
      .mockResolvedValueOnce(locked)
      .mockResolvedValueOnce(current);

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    gateway.parseEvent.mockReturnValue(event());
    queryBuilder.execute.mockResolvedValue({ raw: [{ id: 'row1' }] });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('answers 404 for a provider the API is not configured with', async () => {
    await expect(
      service.receive(PaymentProvider.Stripe, RAW, SIGNATURE),
    ).rejects.toThrow(new NotFoundException('payments.WEBHOOK_NOT_FOUND'));
    expect(gateway.parseEvent).not.toHaveBeenCalled();
  });

  it.each([
    [undefined, SIGNATURE],
    [RAW, undefined],
  ])('answers 400 without a body or signature', async (raw, signature) => {
    await expect(
      service.receive(PaymentProvider.Mock, raw, signature),
    ).rejects.toThrow(new BadRequestException('payments.INVALID_WEBHOOK'));
  });

  it('answers 400 when the gateway rejects the signature', async () => {
    gateway.parseEvent.mockImplementation(() => {
      throw new InvalidWebhookError('signature mismatch');
    });

    await expect(receive()).rejects.toThrow(
      new BadRequestException('payments.INVALID_WEBHOOK'),
    );
  });

  it('lets an unexpected parsing error through', async () => {
    gateway.parseEvent.mockImplementation(() => {
      throw new TypeError('boom');
    });

    await expect(receive()).rejects.toThrow(TypeError);
  });

  it('records the event once, keyed by provider and event id', async () => {
    stored(payment(), order());

    await receive();

    expect(queryBuilder.into).toHaveBeenCalledWith(PaymentEvent);
    expect(queryBuilder.values).toHaveBeenCalledWith({
      provider: PaymentProvider.Mock,
      providerEventId: 'evt_1',
      type: 'payment_intent.succeeded',
      payload: { id: 'evt_1' },
    });
    expect(queryBuilder.orIgnore).toHaveBeenCalled();
  });

  it('skips an event already received', async () => {
    queryBuilder.execute.mockResolvedValue({ raw: [] });

    await expect(receive()).resolves.toEqual({ id: 'evt_1', duplicate: true });
    expect(managerMock.findOne).not.toHaveBeenCalled();
  });

  it('acknowledges an event it has nothing to do with', async () => {
    gateway.parseEvent.mockReturnValue(
      event({ type: 'charge.updated', status: null, providerPaymentId: null }),
    );

    await expect(receive()).resolves.toEqual({
      id: 'evt_1',
      duplicate: false,
    });
    expect(managerMock.findOne).not.toHaveBeenCalled();
  });

  it('acknowledges an event for an intent it never opened', async () => {
    managerMock.findOne.mockResolvedValueOnce(null);

    await expect(receive()).resolves.toEqual({
      id: 'evt_1',
      duplicate: false,
    });
    expect(managerMock.update).not.toHaveBeenCalled();
  });

  it('marks the payment and the order paid on success', async () => {
    stored(payment(), order());

    await receive();

    expect(managerMock.findOne).toHaveBeenNthCalledWith(2, Order, {
      where: { id: 'o1' },
      lock: { mode: 'pessimistic_write' },
    });
    expect(managerMock.update).toHaveBeenCalledWith(
      Payment,
      { id: 'pay1' },
      {
        status: PaymentAttemptStatus.Succeeded,
        cardBrand: 'visa',
        cardLast4: '4242',
        succeededAt: expect.any(Date) as Date,
        failureCode: null,
        failureMessage: null,
      },
    );
    expect(managerMock.update).toHaveBeenCalledWith(
      Order,
      { id: 'o1' },
      {
        paymentStatus: PaymentStatus.Paid,
        paidAt: expect.any(Date) as Date,
      },
    );
    expect(managerMock.update).toHaveBeenCalledWith(
      PaymentEvent,
      { id: 'row1' },
      { paymentId: 'pay1' },
    );
    expect(refunds.refund).not.toHaveBeenCalled();
  });

  it.each([
    ['already paid by another attempt', { paymentStatus: PaymentStatus.Paid }],
    ['cancelled meanwhile', { status: OrderStatus.Cancelled }],
  ])(
    'refunds a success on an order %s',
    async (_case, overrides: Partial<Order>) => {
      const current = payment();

      stored(current, order(overrides));

      await receive();

      expect(refunds.refund).toHaveBeenCalledWith(manager, current);
      expect(managerMock.update).not.toHaveBeenCalledWith(
        Order,
        expect.anything(),
        expect.anything(),
      );
    },
  );

  it('keeps the decline reason on failure, trimmed to the column', async () => {
    gateway.parseEvent.mockReturnValue(
      event({
        type: 'payment_intent.payment_failed',
        status: PaymentAttemptStatus.Failed,
        card: null,
        failure: { code: 'card_declined', message: 'x'.repeat(300) },
      }),
    );
    stored(payment(), order());

    await receive();

    expect(managerMock.update).toHaveBeenCalledWith(
      Payment,
      { id: 'pay1' },
      {
        status: PaymentAttemptStatus.Failed,
        failureCode: 'card_declined',
        failureMessage: 'x'.repeat(255),
      },
    );
    expect(managerMock.update).not.toHaveBeenCalledWith(
      Order,
      expect.anything(),
      expect.anything(),
    );
  });

  it('accepts a success after a decline, clearing the old reason', async () => {
    stored(payment(PaymentAttemptStatus.Failed), order());

    await receive();

    expect(managerMock.update).toHaveBeenCalledWith(
      Payment,
      { id: 'pay1' },
      expect.objectContaining({
        status: PaymentAttemptStatus.Succeeded,
        failureCode: null,
        failureMessage: null,
      }),
    );
    expect(managerMock.update).toHaveBeenCalledWith(
      Order,
      { id: 'o1' },
      expect.objectContaining({ paymentStatus: PaymentStatus.Paid }),
    );
  });

  it('moves a pending payment to REQUIRES_ACTION', async () => {
    gateway.parseEvent.mockReturnValue(
      event({
        type: 'payment_intent.requires_action',
        status: PaymentAttemptStatus.RequiresAction,
        card: null,
      }),
    );
    stored(payment(), order());

    await receive();

    expect(managerMock.update).toHaveBeenCalledWith(
      Payment,
      { id: 'pay1' },
      { status: PaymentAttemptStatus.RequiresAction },
    );
  });

  it('ignores an event arriving after the payment moved on', async () => {
    gateway.parseEvent.mockReturnValue(
      event({ status: PaymentAttemptStatus.Failed }),
    );
    stored(payment(PaymentAttemptStatus.Succeeded), order());

    await receive();

    expect(managerMock.update).toHaveBeenCalledTimes(1);
    expect(managerMock.update).toHaveBeenCalledWith(
      PaymentEvent,
      { id: 'row1' },
      { paymentId: 'pay1' },
    );
  });
});
