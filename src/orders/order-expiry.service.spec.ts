import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EntityManager, In, LessThan, Repository } from 'typeorm';

import { transactionalDataSource } from '../database/transaction.fixture';
import { MAIL_FALLBACK_LANGUAGE, MAIL_JOB } from '../mail/mail.constants';
import { MailQueueService } from '../mail/mail-queue.service';
import { User } from '../users/entities/user.entity';
import { Order } from './entities/order.entity';
import { OrderStatus } from './enums/order-status.enum';
import { PaymentStatus } from './enums/payment-status.enum';
import { OrderStatusChange } from './interfaces/order-status-change.interface';
import { OrderExpiryService } from './order-expiry.service';
import { OrderTransitionsService } from './order-transitions.service';
import { ORDER_AUTO_CANCEL_BATCH_SIZE } from './orders.constants';

describe('OrderExpiryService', () => {
  const DAYS = 7;
  const NOW = new Date('2026-10-18T10:00:00.000Z');
  const CUTOFF = new Date('2026-10-11T10:00:00.000Z');
  const CUSTOMER = {
    id: 'u1',
    email: 'son@example.com',
    fullName: 'Lanh Hung Son',
  } as User;

  const order = (
    id: string,
    status = OrderStatus.Pending,
    paymentStatus = PaymentStatus.Unpaid,
  ) =>
    ({
      id,
      code: `ORD-${id}`,
      userId: CUSTOMER.id,
      status,
      paymentStatus,
    }) as Order;

  const ordersRepository = { find: jest.fn() };
  const usersRepository = { find: jest.fn() };
  const managerMock = { findOne: jest.fn() };
  const { dataSource, transaction } = transactionalDataSource(
    managerMock as unknown as EntityManager,
  );
  const transitionsMock = {
    apply: jest.fn(
      (_manager: EntityManager, value: Order, change: OrderStatusChange) =>
        Promise.resolve({ ...value, status: change.to }),
    ),
  };
  const mailMock = { enqueue: jest.fn() };
  const configMock = { getOrThrow: () => ({ autoCancelDays: DAYS }) };

  const service = new OrderExpiryService(
    dataSource,
    ordersRepository as unknown as Repository<Order>,
    usersRepository as unknown as Repository<User>,
    transitionsMock as unknown as OrderTransitionsService,
    mailMock as unknown as MailQueueService,
    configMock as unknown as ConfigService,
  );

  let logError: jest.SpyInstance;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    logError = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    usersRepository.find.mockResolvedValue([CUSTOMER]);
    managerMock.findOne.mockImplementation(
      (_entity: unknown, { where }: { where: { id: string } }) =>
        Promise.resolve(order(where.id)),
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  describe('findExpired', () => {
    it('takes the oldest unpaid PENDING orders created before the cutoff, one batch at a time', async () => {
      ordersRepository.find.mockResolvedValue([]);

      await service.findExpired(CUTOFF);

      expect(ordersRepository.find).toHaveBeenCalledWith({
        where: {
          status: OrderStatus.Pending,
          paymentStatus: PaymentStatus.Unpaid,
          createdAt: LessThan(CUTOFF),
        },
        order: { createdAt: 'ASC', id: 'ASC' },
        take: ORDER_AUTO_CANCEL_BATCH_SIZE,
      });
    });
  });

  describe('cancelExpired', () => {
    it(`looks ${DAYS} days back from now`, async () => {
      ordersRepository.find.mockResolvedValue([]);

      await expect(service.cancelExpired(NOW)).resolves.toBe(0);

      expect(ordersRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: LessThan(CUTOFF),
          }) as object,
        }),
      );
      expect(usersRepository.find).not.toHaveBeenCalled();
    });

    it('cancels each order in its own transaction, as the system', async () => {
      ordersRepository.find.mockResolvedValue([order('o1'), order('o2')]);

      await expect(service.cancelExpired(NOW)).resolves.toBe(2);

      expect(transaction).toHaveBeenCalledTimes(2);
      expect(managerMock.findOne).toHaveBeenCalledWith(Order, {
        where: { id: 'o1' },
        lock: { mode: 'pessimistic_write' },
      });
      expect(transitionsMock.apply).toHaveBeenCalledWith(
        managerMock,
        order('o1'),
        { to: OrderStatus.Cancelled, changedBy: null },
      );
    });

    it('loads every customer of the batch in one query and emails them', async () => {
      ordersRepository.find.mockResolvedValue([order('o1'), order('o2')]);

      await service.cancelExpired(NOW);

      expect(usersRepository.find).toHaveBeenCalledTimes(1);
      expect(usersRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: In([CUSTOMER.id]) },
          withDeleted: true,
        }),
      );
      expect(mailMock.enqueue).toHaveBeenCalledWith(
        MAIL_JOB.OrderAutoCancelled,
        {
          to: CUSTOMER.email,
          fullName: CUSTOMER.fullName,
          orderCode: 'ORD-o1',
          days: DAYS,
          lang: MAIL_FALLBACK_LANGUAGE,
        },
      );
    });

    it('leaves alone an order an admin confirmed in the meantime', async () => {
      ordersRepository.find.mockResolvedValue([order('o1')]);
      managerMock.findOne.mockResolvedValue(order('o1', OrderStatus.Confirmed));

      await expect(service.cancelExpired(NOW)).resolves.toBe(0);

      expect(transitionsMock.apply).not.toHaveBeenCalled();
      expect(mailMock.enqueue).not.toHaveBeenCalled();
    });

    it('leaves alone an order the customer paid in the meantime', async () => {
      ordersRepository.find.mockResolvedValue([order('o1')]);
      managerMock.findOne.mockResolvedValue(
        order('o1', OrderStatus.Pending, PaymentStatus.Paid),
      );

      await expect(service.cancelExpired(NOW)).resolves.toBe(0);

      expect(transitionsMock.apply).not.toHaveBeenCalled();
    });

    it('carries on with the batch when one order fails', async () => {
      ordersRepository.find.mockResolvedValue([order('o1'), order('o2')]);
      transitionsMock.apply.mockRejectedValueOnce(new Error('deadlock'));

      await expect(service.cancelExpired(NOW)).resolves.toBe(1);

      expect(logError).toHaveBeenCalledWith(
        'Could not cancel expired order o1: deadlock',
      );
      expect(mailMock.enqueue).toHaveBeenCalledTimes(1);
    });

    it('skips the email of a customer it cannot find', async () => {
      ordersRepository.find.mockResolvedValue([order('o1')]);
      usersRepository.find.mockResolvedValue([]);

      await expect(service.cancelExpired(NOW)).resolves.toBe(1);

      expect(mailMock.enqueue).not.toHaveBeenCalled();
    });
  });
});
