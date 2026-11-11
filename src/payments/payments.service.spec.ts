import {
  BadGatewayException,
  ConflictException,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { EntityManager, In, Repository } from 'typeorm';

import { transactionalDataSource } from '../database/transaction.fixture';
import { Order } from '../orders/entities/order.entity';
import { OrderStatus } from '../orders/enums/order-status.enum';
import { PaymentMethod } from '../orders/enums/payment-method.enum';
import { PaymentStatus } from '../orders/enums/payment-status.enum';
import { User } from '../users/entities/user.entity';
import { Payment } from './entities/payment.entity';
import { PaymentAttemptStatus } from './enums/payment-attempt-status.enum';
import { PaymentProvider } from './enums/payment-provider.enum';
import { PaymentGateway } from './interfaces/payment-gateway.interface';
import { OPEN_PAYMENT_STATUSES } from './payments.constants';
import { PaymentsService } from './payments.service';

describe('PaymentsService', () => {
  const USER = { id: 'u1' } as User;
  const CODE = 'ORD-20261110-0001';
  const INTENT = {
    providerPaymentId: 'mock_pi_1',
    clientSecret: 'mock_pi_1_secret_1',
  };

  const order = (overrides: Partial<Order> = {}): Order =>
    ({
      id: 'o1',
      code: CODE,
      userId: USER.id,
      status: OrderStatus.Pending,
      paymentMethod: PaymentMethod.Card,
      paymentStatus: PaymentStatus.Unpaid,
      total: 330000,
      ...overrides,
    }) as Order;

  const managerMock = {
    findOne: jest.fn(),
    create: jest.fn((_entity: unknown, value: Partial<Payment>) => value),
    save: jest.fn((value: Partial<Payment>) => Promise.resolve(value)),
  };
  const manager = managerMock as unknown as EntityManager;
  const { dataSource } = transactionalDataSource(manager);
  const ordersRepository = { findOne: jest.fn() };
  const paymentsRepository = { findAndCount: jest.fn() };
  const gateway = {
    provider: PaymentProvider.Mock,
    createIntent: jest.fn(),
  };
  const i18n = { t: jest.fn((key: string) => key) };

  const service = new PaymentsService(
    dataSource,
    ordersRepository as unknown as Repository<Order>,
    paymentsRepository as unknown as Repository<Payment>,
    gateway as unknown as PaymentGateway,
    i18n as unknown as I18nService,
  );

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    gateway.createIntent.mockResolvedValue(INTENT);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  describe('start', () => {
    const lockedOrder = (value: Order | null) =>
      managerMock.findOne.mockResolvedValueOnce(value);

    it('opens an intent for the order total and records the attempt', async () => {
      lockedOrder(order()).mockResolvedValueOnce(null);

      const payment = await service.start(USER, CODE);

      expect(managerMock.findOne).toHaveBeenNthCalledWith(1, Order, {
        where: { code: CODE, userId: USER.id },
        lock: { mode: 'pessimistic_write' },
      });
      expect(managerMock.findOne).toHaveBeenNthCalledWith(2, Payment, {
        where: { orderId: 'o1', status: In(OPEN_PAYMENT_STATUSES) },
      });
      expect(gateway.createIntent).toHaveBeenCalledWith({
        paymentId: payment.id,
        orderCode: CODE,
        amount: 330000,
        currency: 'VND',
      });
      expect(payment).toEqual({
        id: expect.any(String) as string,
        orderId: 'o1',
        provider: PaymentProvider.Mock,
        ...INTENT,
        status: PaymentAttemptStatus.Pending,
        amount: 330000,
        currency: 'VND',
      });
    });

    it('returns the open attempt instead of opening a second one', async () => {
      const open = { id: 'pay1', status: PaymentAttemptStatus.Pending };

      lockedOrder(order()).mockResolvedValueOnce(open);

      await expect(service.start(USER, CODE)).resolves.toBe(open);
      expect(gateway.createIntent).not.toHaveBeenCalled();
      expect(managerMock.save).not.toHaveBeenCalled();
    });

    it('answers 404 for an order I do not own', async () => {
      lockedOrder(null);

      await expect(service.start(USER, CODE)).rejects.toThrow(
        new NotFoundException('orders.NOT_FOUND'),
      );
    });

    it.each([PaymentMethod.Cod, PaymentMethod.BankTransfer])(
      'refuses a %s order with 422',
      async (paymentMethod) => {
        lockedOrder(order({ paymentMethod }));

        await expect(service.start(USER, CODE)).rejects.toThrow(
          new UnprocessableEntityException('payments.CARD_ONLY'),
        );
      },
    );

    it.each([PaymentStatus.Paid, PaymentStatus.Refunded])(
      'refuses a %s order with 409',
      async (paymentStatus) => {
        lockedOrder(order({ paymentStatus }));

        await expect(service.start(USER, CODE)).rejects.toThrow(
          new ConflictException('orders.ALREADY_PAID'),
        );
      },
    );

    it.each([
      OrderStatus.Shipping,
      OrderStatus.Delivered,
      OrderStatus.Cancelled,
      OrderStatus.Rejected,
    ])('refuses a %s order with 422', async (status) => {
      lockedOrder(order({ status }));

      await expect(service.start(USER, CODE)).rejects.toThrow(
        new UnprocessableEntityException('orders.INVALID_STATE'),
      );
    });

    it('answers 502 and records nothing when the provider fails', async () => {
      lockedOrder(order()).mockResolvedValueOnce(null);
      gateway.createIntent.mockRejectedValue(new Error('connect ECONNREFUSED'));

      await expect(service.start(USER, CODE)).rejects.toThrow(
        new BadGatewayException('payments.GATEWAY_UNAVAILABLE'),
      );
      expect(managerMock.save).not.toHaveBeenCalled();
    });
  });

  describe('list', () => {
    it('pages the attempts of my order, newest first', async () => {
      const payments = [{ id: 'pay2' }, { id: 'pay1' }];

      ordersRepository.findOne.mockResolvedValue({ id: 'o1' });
      paymentsRepository.findAndCount.mockResolvedValue([payments, 2]);

      await expect(
        service.list(USER, CODE, { limit: 20, offset: 0 }),
      ).resolves.toEqual({ payments, total: 2 });
      expect(ordersRepository.findOne).toHaveBeenCalledWith({
        where: { code: CODE, userId: USER.id },
        select: { id: true },
      });
      expect(paymentsRepository.findAndCount).toHaveBeenCalledWith({
        where: { orderId: 'o1' },
        order: { createdAt: 'DESC', id: 'DESC' },
        take: 20,
        skip: 0,
      });
    });

    it('answers 404 for an order I do not own', async () => {
      ordersRepository.findOne.mockResolvedValue(null);

      await expect(
        service.list(USER, CODE, { limit: 20, offset: 0 }),
      ).rejects.toThrow(new NotFoundException('orders.NOT_FOUND'));
    });
  });
});
