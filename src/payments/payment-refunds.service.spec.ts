import { Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { EntityManager, In, LessThan, Not, Repository } from 'typeorm';

import { TransactionHooks } from '../database/transaction-hooks.service';
import { transactionalDataSource } from '../database/transaction.fixture';
import { Order } from '../orders/entities/order.entity';
import { OrderStatus } from '../orders/enums/order-status.enum';
import { PaymentMethod } from '../orders/enums/payment-method.enum';
import { PaymentStatus } from '../orders/enums/payment-status.enum';
import { Payment } from './entities/payment.entity';
import { PaymentAttemptStatus } from './enums/payment-attempt-status.enum';
import { PaymentGateway } from './interfaces/payment-gateway.interface';
import { RefundJobData } from './interfaces/refund-job.interface';
import { PaymentRefundsService } from './payment-refunds.service';
import { PAYMENT_JOB } from './payments.constants';

describe('PaymentRefundsService', () => {
  const order = (overrides: Partial<Order> = {}): Order =>
    ({
      id: 'o1',
      code: 'ORD-20261110-0001',
      status: OrderStatus.Cancelled,
      paymentMethod: PaymentMethod.Card,
      paymentStatus: PaymentStatus.Paid,
      ...overrides,
    }) as Order;

  const payment = (status = PaymentAttemptStatus.Succeeded): Payment =>
    ({
      id: 'pay1',
      orderId: 'o1',
      providerPaymentId: 'mock_pi_1',
      status,
    }) as Payment;

  const managerMock = {
    findOne: jest.fn(),
    update: jest.fn(),
    exists: jest.fn(),
  };
  const manager = managerMock as unknown as EntityManager;
  const { dataSource } = transactionalDataSource(manager);
  const repository = { findOneBy: jest.fn(), find: jest.fn() };
  const gateway = { refund: jest.fn() };
  const queue = { add: jest.fn(), getJob: jest.fn() };
  const tasks: (() => Promise<void>)[] = [];
  const hooks = {
    afterCommit: jest.fn((_manager: unknown, task: () => Promise<void>) => {
      tasks.push(task);

      return Promise.resolve();
    }),
  };

  const service = new PaymentRefundsService(
    dataSource,
    repository as unknown as Repository<Payment>,
    gateway as unknown as PaymentGateway,
    queue as unknown as Queue<RefundJobData>,
    hooks as unknown as TransactionHooks,
  );

  let warn: jest.SpyInstance;
  let error: jest.SpyInstance;

  const runCommitted = () => Promise.all(tasks.map((task) => task()));

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    queue.add.mockResolvedValue({ id: 'refund-pay1' });
    managerMock.exists.mockResolvedValue(false);
    gateway.refund.mockResolvedValue({ providerRefundId: 'mock_re_1' });
  });

  afterEach(() => {
    tasks.length = 0;
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  describe('refundOrder', () => {
    it.each([
      ['a cash on delivery order', { paymentMethod: PaymentMethod.Cod }],
      ['a bank transfer order', { paymentMethod: PaymentMethod.BankTransfer }],
      ['an unpaid card order', { paymentStatus: PaymentStatus.Unpaid }],
    ])('leaves %s alone', async (_case, overrides: Partial<Order>) => {
      await service.refundOrder(manager, order(overrides));

      expect(managerMock.findOne).not.toHaveBeenCalled();
      expect(hooks.afterCommit).not.toHaveBeenCalled();
    });

    it('locks the successful payment and queues its refund after commit', async () => {
      managerMock.findOne.mockResolvedValue(payment());

      await service.refundOrder(manager, order());

      expect(managerMock.findOne).toHaveBeenCalledWith(Payment, {
        where: { orderId: 'o1', status: PaymentAttemptStatus.Succeeded },
        lock: { mode: 'pessimistic_write' },
      });
      expect(managerMock.update).toHaveBeenCalledWith(
        Payment,
        { id: 'pay1' },
        { status: PaymentAttemptStatus.RefundPending },
      );
      expect(queue.add).not.toHaveBeenCalled();

      await runCommitted();

      expect(queue.add).toHaveBeenCalledWith(
        PAYMENT_JOB.Refund,
        { paymentId: 'pay1' },
        { jobId: 'refund-pay1' },
      );
    });

    it('warns when a paid card order has no successful payment', async () => {
      managerMock.findOne.mockResolvedValue(null);

      await service.refundOrder(manager, order());

      expect(managerMock.update).not.toHaveBeenCalled();
      expect(warn).toHaveBeenCalled();
    });

    it('logs instead of failing when the queue is down', async () => {
      managerMock.findOne.mockResolvedValue(payment());
      queue.add.mockRejectedValue(new Error('Connection is closed'));

      await service.refundOrder(manager, order());
      await expect(runCommitted()).resolves.toBeDefined();

      expect(error).toHaveBeenCalledWith(
        expect.stringContaining('Connection is closed'),
      );
    });
  });

  describe('complete', () => {
    const locked = (lockedOrder: Order | null, lockedPayment: Payment | null) =>
      managerMock.findOne
        .mockResolvedValueOnce(lockedOrder)
        .mockResolvedValueOnce(lockedPayment);

    it.each([null, payment(PaymentAttemptStatus.Refunded)])(
      'does nothing for %p',
      async (current) => {
        repository.findOneBy.mockResolvedValue(current);

        await service.complete('pay1');

        expect(gateway.refund).not.toHaveBeenCalled();
      },
    );

    it('refunds at the provider, then marks the payment and the order', async () => {
      repository.findOneBy.mockResolvedValue(
        payment(PaymentAttemptStatus.RefundPending),
      );
      locked(order(), payment(PaymentAttemptStatus.RefundPending));

      await service.complete('pay1');

      expect(gateway.refund).toHaveBeenCalledWith('mock_pi_1', 'pay1');
      expect(managerMock.update).toHaveBeenCalledWith(
        Payment,
        { id: 'pay1' },
        {
          status: PaymentAttemptStatus.Refunded,
          providerRefundId: 'mock_re_1',
          refundedAt: expect.any(Date) as Date,
        },
      );
      expect(managerMock.update).toHaveBeenCalledWith(
        Order,
        { id: 'o1' },
        { paymentStatus: PaymentStatus.Refunded },
      );
    });

    it.each([
      ['paid by another attempt', { status: OrderStatus.Pending }],
      ['never marked paid', { paymentStatus: PaymentStatus.Unpaid }],
    ])(
      'keeps the payment status of an order %s',
      async (_case, overrides: Partial<Order>) => {
        repository.findOneBy.mockResolvedValue(
          payment(PaymentAttemptStatus.RefundPending),
        );
        locked(order(overrides), payment(PaymentAttemptStatus.RefundPending));

        await service.complete('pay1');

        expect(managerMock.update).toHaveBeenCalledTimes(1);
        expect(managerMock.update).toHaveBeenCalledWith(
          Payment,
          { id: 'pay1' },
          expect.objectContaining({ status: PaymentAttemptStatus.Refunded }),
        );
      },
    );

    it('writes nothing when another worker finished it first', async () => {
      repository.findOneBy.mockResolvedValue(
        payment(PaymentAttemptStatus.RefundPending),
      );
      locked(order(), payment(PaymentAttemptStatus.Refunded));

      await service.complete('pay1');

      expect(managerMock.update).not.toHaveBeenCalled();
    });

    it('lets a provider failure through so the job is retried', async () => {
      repository.findOneBy.mockResolvedValue(
        payment(PaymentAttemptStatus.RefundPending),
      );
      gateway.refund.mockRejectedValue(new Error('timeout'));

      await expect(service.complete('pay1')).rejects.toThrow('timeout');
      expect(managerMock.update).not.toHaveBeenCalled();
    });
  });
  describe('complete with several attempts', () => {
    it('keeps the order PAID while another attempt still holds money', async () => {
      repository.findOneBy.mockResolvedValue(
        payment(PaymentAttemptStatus.RefundPending),
      );
      managerMock.findOne
        .mockResolvedValueOnce(order())
        .mockResolvedValueOnce(payment(PaymentAttemptStatus.RefundPending));
      managerMock.exists.mockResolvedValue(true);

      await service.complete('pay1');

      expect(managerMock.exists).toHaveBeenCalledWith(Payment, {
        where: {
          orderId: 'o1',
          id: Not('pay1'),
          status: In([
            PaymentAttemptStatus.Succeeded,
            PaymentAttemptStatus.RefundPending,
          ]),
        },
      });
      expect(managerMock.update).not.toHaveBeenCalledWith(
        Order,
        expect.anything(),
        expect.anything(),
      );
    });
  });

  describe('retryStale', () => {
    const NOW = new Date('2026-11-10T03:00:00.000Z');
    const job = (state: string) => ({
      getState: jest.fn().mockResolvedValue(state),
      remove: jest.fn(),
    });

    beforeEach(() => {
      repository.find.mockResolvedValue([{ id: 'pay1' }]);
    });

    it('looks up refunds pending for longer than the retry delay', async () => {
      queue.getJob.mockResolvedValue(undefined);

      await service.retryStale(NOW);

      expect(repository.find).toHaveBeenCalledWith({
        where: {
          status: PaymentAttemptStatus.RefundPending,
          updatedAt: LessThan(new Date('2026-11-10T02:50:00.000Z')),
        },
        select: { id: true },
        order: { updatedAt: 'ASC', id: 'ASC' },
        take: 100,
      });
    });

    it('queues a refund whose job was lost', async () => {
      queue.getJob.mockResolvedValue(undefined);

      await expect(service.retryStale(NOW)).resolves.toBe(1);
      expect(queue.add).toHaveBeenCalledWith(
        PAYMENT_JOB.Refund,
        { paymentId: 'pay1' },
        { jobId: 'refund-pay1' },
      );
    });

    it.each(['failed', 'completed'])(
      'replaces a %s job, which BullMQ would otherwise keep',
      async (state) => {
        const settled = job(state);

        queue.getJob.mockResolvedValue(settled);

        await expect(service.retryStale(NOW)).resolves.toBe(1);
        expect(settled.remove).toHaveBeenCalled();
        expect(queue.add).toHaveBeenCalled();
      },
    );

    it.each(['waiting', 'active', 'delayed'])(
      'leaves a %s job alone',
      async (state) => {
        const inFlight = job(state);

        queue.getJob.mockResolvedValue(inFlight);

        await expect(service.retryStale(NOW)).resolves.toBe(0);
        expect(inFlight.remove).not.toHaveBeenCalled();
        expect(queue.add).not.toHaveBeenCalled();
      },
    );

    it('skips a refund it cannot inspect, and counts a failed add as not requeued', async () => {
      repository.find.mockResolvedValue([{ id: 'pay1' }, { id: 'pay2' }]);
      queue.getJob
        .mockRejectedValueOnce(new Error('Connection is closed'))
        .mockResolvedValueOnce(undefined);
      queue.add.mockRejectedValue(new Error('Connection is closed'));

      await expect(service.retryStale(NOW)).resolves.toBe(0);
      expect(error).toHaveBeenCalledTimes(2);
    });
  });
});
