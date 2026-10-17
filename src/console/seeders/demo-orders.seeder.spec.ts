import { Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { CartService } from '../../cart/cart.service';
import { DEMO_ORDERS } from '../../database/seeds/demo.seed-data';
import {
  DEMO_CANCEL_REASON,
  DEMO_DELIVERY_SPREAD_MONTHS,
  DEMO_MAX_QUANTITY,
  DEMO_REJECT_REASON,
} from '../../database/seeds/seed.constants';
import { OrderStatus } from '../../orders/enums/order-status.enum';
import { OrdersAdminService } from '../../orders/orders-admin.service';
import { OrdersService } from '../../orders/orders.service';
import { Product } from '../../products/entities/product.entity';
import { RATING_MAX, RATING_MIN } from '../../reviews/reviews.constants';
import { ReviewsService } from '../../reviews/reviews.service';
import { buildUser } from '../../users/entities/user.fixture';
import { User } from '../../users/entities/user.entity';
import { DemoOrdersSeeder } from './demo-orders.seeder';

type StatusCall = [User, string, { status: OrderStatus; reason: unknown }];
type ReviewCall = [User, string, { rating: number; content: string }];

describe('DemoOrdersSeeder', () => {
  const DAY_MS = 24 * 60 * 60 * 1000;

  const admin = buildUser({ id: 'admin' });
  const buyers = [1, 2, 3, 4].map((n) => buildUser({ id: `buyer-${n}` }));
  const products = Array.from(
    { length: 30 },
    (_value, n) => ({ id: `product-${n}`, slug: `slug-${n}` }) as Product,
  );

  const builder = {
    update: jest.fn(),
    set: jest.fn(),
    where: jest.fn(),
    setParameter: jest.fn(),
    execute: jest.fn(),
  };
  const manager = { createQueryBuilder: () => builder };
  const dataSourceMock = {
    getRepository: () => ({ countBy: countMock }),
    transaction: jest.fn((work: (m: typeof manager) => Promise<unknown>) =>
      work(manager),
    ),
  };
  const countMock = jest.fn();
  const cartMock = { clear: jest.fn(), addItem: jest.fn() };
  const ordersMock = { checkout: jest.fn(), pay: jest.fn(), cancel: jest.fn() };
  const adminMock = { changeStatus: jest.fn() };
  const reviewsMock = { create: jest.fn() };

  const seeder = new DemoOrdersSeeder(
    dataSourceMock as unknown as DataSource,
    cartMock as unknown as CartService,
    ordersMock as unknown as OrdersService,
    adminMock as unknown as OrdersAdminService,
    reviewsMock as unknown as ReviewsService,
  );

  const plannedCount = (status: OrderStatus) =>
    DEMO_ORDERS.filter((plan) => plan.status === status).length;

  const statusCalls = () => adminMock.changeStatus.mock.calls as StatusCall[];
  const reviewCalls = () => reviewsMock.create.mock.calls as ReviewCall[];
  const shifts = () =>
    (builder.setParameter.mock.calls as [string, string][]).map(([, shift]) =>
      parseInt(shift, 10),
    );

  let sequence = 0;

  beforeEach(() => {
    sequence = 0;
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    countMock.mockResolvedValue(0);
    for (const method of ['update', 'set', 'where', 'setParameter'] as const) {
      builder[method].mockReturnValue(builder);
    }
    ordersMock.checkout.mockImplementation(() => {
      sequence += 1;

      return Promise.resolve({
        order: { id: `order-${sequence}`, code: `ORD-${sequence}` },
      });
    });
    ordersMock.pay.mockImplementation((_user, code: string) =>
      Promise.resolve({ order: { id: code, code } }),
    );
    ordersMock.cancel.mockImplementation((_user, code: string) =>
      Promise.resolve({ order: { id: code, code, deliveredAt: null } }),
    );
    adminMock.changeStatus.mockImplementation(
      (_admin, code: string, { status }: { status: OrderStatus }) =>
        Promise.resolve({
          order: {
            id: code,
            code,
            deliveredAt: status === OrderStatus.Delivered ? new Date() : null,
          },
        }),
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('leaves existing demo orders alone', async () => {
    countMock.mockResolvedValue(DEMO_ORDERS.length);

    await seeder.seed(admin, buyers, products);

    expect(ordersMock.checkout).not.toHaveBeenCalled();
  });

  it('refuses to finish the orders of an interrupted run', async () => {
    countMock.mockResolvedValue(3);

    await expect(seeder.seed(admin, buyers, products)).rejects.toThrow(
      /--fresh/,
    );

    expect(ordersMock.checkout).not.toHaveBeenCalled();
  });

  it('refuses to run without a buyer', async () => {
    await expect(seeder.seed(admin, [], products)).rejects.toThrow(
      /No active demo user/,
    );
  });

  it('refuses to run when the catalogue cannot fill the plan', async () => {
    await expect(
      seeder.seed(admin, buyers, products.slice(0, 2)),
    ).rejects.toThrow(/Not enough purchasable products/);
  });

  it('places every planned order through the cart and checkout', async () => {
    await seeder.seed(admin, buyers, products);

    expect(ordersMock.checkout).toHaveBeenCalledTimes(DEMO_ORDERS.length);
    expect(cartMock.clear).toHaveBeenCalledTimes(DEMO_ORDERS.length);
    expect(cartMock.addItem).toHaveBeenCalledTimes(
      DEMO_ORDERS.reduce((sum, { lines }) => sum + lines, 0),
    );
    expect(
      (cartMock.addItem.mock.calls as [string, { quantity: number }][]).every(
        ([, { quantity }]) => quantity >= 1 && quantity <= DEMO_MAX_QUANTITY,
      ),
    ).toBe(true);
  });

  it('never puts the same product twice in one buyer’s orders', async () => {
    await seeder.seed(admin, buyers, products);

    const byBuyer = new Map<string, string[]>();

    for (const [userId, { productId }] of cartMock.addItem.mock.calls as [
      string,
      { productId: string },
    ][]) {
      byBuyer.set(userId, [...(byBuyer.get(userId) ?? []), productId]);
    }

    for (const productIds of byBuyer.values()) {
      expect(new Set(productIds).size).toBe(productIds.length);
    }
  });

  it('drives each order to its planned status', async () => {
    await seeder.seed(admin, buyers, products);

    const moves = (status: OrderStatus) =>
      statusCalls().filter(([, , input]) => input.status === status).length;

    expect(moves(OrderStatus.Delivered)).toBe(
      plannedCount(OrderStatus.Delivered),
    );
    expect(moves(OrderStatus.Rejected)).toBe(
      plannedCount(OrderStatus.Rejected),
    );
    expect(moves(OrderStatus.Confirmed)).toBe(
      plannedCount(OrderStatus.Confirmed) +
        plannedCount(OrderStatus.Shipping) +
        plannedCount(OrderStatus.Delivered),
    );
    expect(ordersMock.cancel).toHaveBeenCalledTimes(
      plannedCount(OrderStatus.Cancelled),
    );
    expect(ordersMock.cancel).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(String),
      { reason: DEMO_CANCEL_REASON },
    );
  });

  it('gives a reason only to a rejection', async () => {
    await seeder.seed(admin, buyers, products);

    for (const [, , { status, reason }] of statusCalls()) {
      expect(reason).toBe(
        status === OrderStatus.Rejected ? DEMO_REJECT_REASON : null,
      );
    }
  });

  it('pays the orders the plan marks as paid', async () => {
    await seeder.seed(admin, buyers, products);

    expect(ordersMock.pay).toHaveBeenCalledTimes(
      DEMO_ORDERS.filter(({ paid }) => paid).length,
    );
    expect(ordersMock.pay).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(String),
      { transactionRef: expect.stringMatching(/^DEMO-TXN-\d+$/) as string },
    );
  });

  it('moves every delivered order and its history back in time', async () => {
    await seeder.seed(admin, buyers, products);

    const delivered = plannedCount(OrderStatus.Delivered);

    expect(dataSourceMock.transaction).toHaveBeenCalledTimes(delivered);
    expect(builder.execute).toHaveBeenCalledTimes(delivered * 2);
    expect(Math.max(...shifts())).toBeLessThan(
      DEMO_DELIVERY_SPREAD_MONTHS * 31 * DAY_MS,
    );
    expect(Math.max(...shifts())).toBeGreaterThan(
      (DEMO_DELIVERY_SPREAD_MONTHS - 2) * 28 * DAY_MS,
    );
  });

  it('reviews every delivered product once, with a rating in range', async () => {
    await seeder.seed(admin, buyers, products);

    const deliveredLines = DEMO_ORDERS.filter(
      ({ status }) => status === OrderStatus.Delivered,
    ).reduce((sum, { lines }) => sum + lines, 0);
    const pairs = reviewCalls().map(([user, slug]) => `${user.id}:${slug}`);

    expect(reviewCalls()).toHaveLength(deliveredLines);
    expect(new Set(pairs).size).toBe(pairs.length);
    expect(
      reviewCalls().every(
        ([, , { rating }]) => rating >= RATING_MIN && rating <= RATING_MAX,
      ),
    ).toBe(true);
  });

  it('produces the same data on every run', async () => {
    const run = async () => {
      jest.clearAllMocks();
      sequence = 0;
      await seeder.seed(admin, buyers, products);

      return {
        items: cartMock.addItem.mock.calls as unknown[],
        reviews: reviewCalls().map(([user, slug, input]) => [
          user.id,
          slug,
          input,
        ]),
      };
    };

    expect(await run()).toEqual(await run());
  });
});
