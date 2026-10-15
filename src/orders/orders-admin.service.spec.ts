import {
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { EntityManager } from 'typeorm';

import { transactionalDataSource } from '../database/transaction.fixture';
import { MAIL_FALLBACK_LANGUAGE, MAIL_JOB } from '../mail/mail.constants';
import { MailQueueService } from '../mail/mail-queue.service';
import { User } from '../users/entities/user.entity';
import { Order } from './entities/order.entity';
import { OrderStatus } from './enums/order-status.enum';
import { PaymentMethod } from './enums/payment-method.enum';
import { PaymentStatus } from './enums/payment-status.enum';
import { OrderStatusChange } from './interfaces/order-status-change.interface';
import { OrderTransitionsService } from './order-transitions.service';
import { REASON_MIN_LENGTH } from './orders.constants';
import { OrdersAdminService } from './orders-admin.service';
import { OrdersViewService } from './orders-view.service';

describe('OrdersAdminService', () => {
  const CODE = 'ORD-20261005-0001';
  const REASON = 'Outside our delivery area';
  const ADMIN = { id: 'a1' } as User;
  const CUSTOMER = {
    id: 'u1',
    email: 'son@example.com',
    username: 'sonlh',
    fullName: 'Lanh Hung Son',
  };

  const order = (overrides: Partial<Order> = {}): Order =>
    ({
      id: 'o1',
      code: CODE,
      userId: CUSTOMER.id,
      status: OrderStatus.Pending,
      paymentMethod: PaymentMethod.Cod,
      paymentStatus: PaymentStatus.Unpaid,
      reason: null,
      ...overrides,
    }) as Order;

  const managerMock = { findOne: jest.fn() };
  const manager = managerMock as unknown as EntityManager;
  const { dataSource, transaction } = transactionalDataSource(manager);
  const transitionsMock = {
    apply: jest.fn(
      (_manager: EntityManager, value: Order, change: OrderStatusChange) =>
        Promise.resolve({ ...value, ...change.patch, status: change.to }),
    ),
  };
  const viewMock = {
    adminDetailOf: jest.fn((value: Order) =>
      Promise.resolve({ order: value, customer: CUSTOMER }),
    ),
  };
  const mailMock = { enqueue: jest.fn() };
  const i18nMock = { t: jest.fn((key: string) => key) };

  const service = new OrdersAdminService(
    dataSource,
    transitionsMock as unknown as OrderTransitionsService,
    viewMock as unknown as OrdersViewService,
    mailMock as unknown as MailQueueService,
    i18nMock as unknown as I18nService,
  );

  const changeOf = () => transitionsMock.apply.mock.calls[0][2];

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('locks the order by code alone and answers 404 when there is none', async () => {
    managerMock.findOne.mockResolvedValue(null);

    await expect(
      service.changeStatus(ADMIN, CODE, { status: OrderStatus.Confirmed }),
    ).rejects.toThrow(new NotFoundException('orders.NOT_FOUND'));
    expect(managerMock.findOne).toHaveBeenCalledWith(Order, {
      where: { code: CODE },
      lock: { mode: 'pessimistic_write' },
    });
  });

  it.each([
    [OrderStatus.Pending, OrderStatus.Shipping],
    [OrderStatus.Pending, OrderStatus.Delivered],
    [OrderStatus.Confirmed, OrderStatus.Confirmed],
    [OrderStatus.Confirmed, OrderStatus.Rejected],
    [OrderStatus.Delivered, OrderStatus.Shipping],
    [OrderStatus.Cancelled, OrderStatus.Confirmed],
  ] as const)(
    'answers 422 naming both statuses for %s -> %s and changes nothing',
    async (from, to) => {
      managerMock.findOne.mockResolvedValue(order({ status: from }));

      await expect(
        service.changeStatus(ADMIN, CODE, { status: to, reason: REASON }),
      ).rejects.toThrow(
        new UnprocessableEntityException('orders.INVALID_TRANSITION'),
      );
      expect(i18nMock.t).toHaveBeenCalledWith('orders.INVALID_TRANSITION', {
        args: { from, to },
      });
      expect(transitionsMock.apply).not.toHaveBeenCalled();
      expect(mailMock.enqueue).not.toHaveBeenCalled();
    },
  );

  it.each([undefined, null])(
    'answers 422 for a rejection whose reason is %s',
    async (reason) => {
      managerMock.findOne.mockResolvedValue(order());

      await expect(
        service.changeStatus(ADMIN, CODE, {
          status: OrderStatus.Rejected,
          reason,
        }),
      ).rejects.toThrow(
        new UnprocessableEntityException('orders.REASON_REQUIRED'),
      );
      expect(i18nMock.t).toHaveBeenCalledWith('orders.REASON_REQUIRED', {
        args: { min: REASON_MIN_LENGTH },
      });
      expect(transitionsMock.apply).not.toHaveBeenCalled();
    },
  );

  it('rejects with the reason on the order and in the history', async () => {
    managerMock.findOne.mockResolvedValue(order());

    await service.changeStatus(ADMIN, CODE, {
      status: OrderStatus.Rejected,
      reason: REASON,
    });

    expect(transitionsMock.apply).toHaveBeenCalledWith(manager, order(), {
      to: OrderStatus.Rejected,
      reason: REASON,
      changedBy: ADMIN.id,
      patch: { reason: REASON },
    });
  });

  it('keeps a reason given on confirmation in the history only', async () => {
    managerMock.findOne.mockResolvedValue(order());

    await service.changeStatus(ADMIN, CODE, {
      status: OrderStatus.Confirmed,
      reason: 'Called the customer first',
    });

    expect(changeOf()).toEqual({
      to: OrderStatus.Confirmed,
      reason: 'Called the customer first',
      changedBy: ADMIN.id,
      patch: {},
    });
  });

  it('stamps the delivery and settles a cash-on-delivery order', async () => {
    managerMock.findOne.mockResolvedValue(
      order({ status: OrderStatus.Shipping }),
    );

    await service.changeStatus(ADMIN, CODE, { status: OrderStatus.Delivered });

    const { patch } = changeOf();

    expect(patch).toEqual({
      deliveredAt: expect.any(Date) as Date,
      paymentStatus: PaymentStatus.Paid,
      paidAt: patch?.deliveredAt,
    });
  });

  it.each([
    [PaymentMethod.BankTransfer, PaymentStatus.Unpaid],
    [PaymentMethod.BankTransfer, PaymentStatus.Paid],
  ])(
    'stamps the delivery of a %s %s order without touching its payment',
    async (paymentMethod, paymentStatus) => {
      managerMock.findOne.mockResolvedValue(
        order({ status: OrderStatus.Shipping, paymentMethod, paymentStatus }),
      );

      await service.changeStatus(ADMIN, CODE, {
        status: OrderStatus.Delivered,
      });

      expect(changeOf().patch).toEqual({
        deliveredAt: expect.any(Date) as Date,
      });
    },
  );

  it.each([
    [OrderStatus.Pending, OrderStatus.Confirmed, null],
    [OrderStatus.Pending, OrderStatus.Rejected, REASON],
  ] as const)(
    'emails the customer on %s -> %s, with the reason of a rejection only',
    async (from, status, reason) => {
      managerMock.findOne.mockResolvedValue(order({ status: from }));

      await service.changeStatus(ADMIN, CODE, { status, reason: REASON });

      expect(mailMock.enqueue).toHaveBeenCalledWith(
        MAIL_JOB.OrderStatusChanged,
        {
          to: CUSTOMER.email,
          fullName: CUSTOMER.fullName,
          orderCode: CODE,
          status,
          reason,
          lang: MAIL_FALLBACK_LANGUAGE,
        },
      );
    },
  );

  it('queues the email only once the transaction has committed', async () => {
    const events: string[] = [];
    managerMock.findOne.mockResolvedValue(order());
    transaction.mockImplementationOnce(
      async (work: (manager: EntityManager) => Promise<unknown>) => {
        const result = await work(manager);
        events.push('commit');

        return result;
      },
    );
    mailMock.enqueue.mockImplementationOnce(() => {
      events.push('mail');

      return Promise.resolve();
    });

    await service.changeStatus(ADMIN, CODE, { status: OrderStatus.Confirmed });

    expect(events).toEqual(['commit', 'mail']);
  });

  it.each([
    [OrderStatus.Confirmed, OrderStatus.Shipping],
    [OrderStatus.Shipping, OrderStatus.Delivered],
  ] as const)('sends no email on %s -> %s', async (from, status) => {
    managerMock.findOne.mockResolvedValue(order({ status: from }));

    await service.changeStatus(ADMIN, CODE, { status });

    expect(mailMock.enqueue).not.toHaveBeenCalled();
  });

  it('answers with the admin view of the changed order', async () => {
    managerMock.findOne.mockResolvedValue(order());

    const detail = await service.changeStatus(ADMIN, CODE, {
      status: OrderStatus.Confirmed,
    });

    expect(viewMock.adminDetailOf).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'o1', status: OrderStatus.Confirmed }),
    );
    expect(detail).toEqual({
      order: expect.objectContaining({
        status: OrderStatus.Confirmed,
      }) as Order,
      customer: CUSTOMER,
    });
  });
});
