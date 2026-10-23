import Redis from 'ioredis';

import { SCHEDULED_JOBS } from '../src/common/constants/scheduled-jobs';
import { MILLISECONDS_PER_DAY } from '../src/common/constants/time';
import { MAIL_JOB } from '../src/mail/mail.constants';
import { AdminOrderResponseDto } from '../src/orders/dto/admin-order.dto';
import { OrderDto } from '../src/orders/dto/order.dto';
import { Order } from '../src/orders/entities/order.entity';
import { OrderStatus } from '../src/orders/enums/order-status.enum';
import { PaymentMethod } from '../src/orders/enums/payment-method.enum';
import { OrdersScheduler } from '../src/orders/orders.scheduler';
import { Product } from '../src/products/entities/product.entity';
import { REDIS_CLIENT } from '../src/redis/redis.constants';
import { UserRole } from '../src/users/enums/user-role.enum';
import { SeededUser } from './support/interfaces/seeded-user.interface';
import { TestContext } from './support/interfaces/test-context.interface';
import { actingAs, changeStatus, placeOrder } from './support/shopper';
import { createTestApp } from './support/test-app';
import { ADMIN_ORDERS_PATH, ORDERS_PATH } from './support/test.constants';

describe('Auto-cancel of expired orders (e2e)', () => {
  const STOCK = 10;
  const AUTO_CANCEL_DAYS = 7;

  let ctx: TestContext;
  let admin: SeededUser;
  let buyer: SeededUser;
  let product: Product;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  beforeEach(async () => {
    admin = await ctx.users.createAuthenticated({ role: UserRole.Admin });
    buyer = await ctx.users.createAuthenticated({ fullName: 'Lanh Hung Son' });
    product = await ctx.catalog.product(await ctx.catalog.category(), {
      stock: STOCK,
    });
  });

  afterEach(async () => {
    await ctx.reset();
  });

  const backdate = (order: OrderDto, days: number) =>
    ctx.dataSource
      .getRepository(Order)
      .update(
        { code: order.code },
        { createdAt: new Date(Date.now() - days * MILLISECONDS_PER_DAY) },
      );

  const stock = async () =>
    (
      await ctx.dataSource
        .getRepository(Product)
        .findOneByOrFail({ id: product.id })
    ).stock;

  const adminView = async (code: string) =>
    (
      (
        await actingAs(ctx, admin)
          .get(`${ADMIN_ORDERS_PATH}/${code}`)
          .expect(200)
      ).body as AdminOrderResponseDto
    ).order;

  const run = () => ctx.app.get(OrdersScheduler).cancelExpiredOrders();

  it('cancels a pending order past the delay and puts its stock back', async () => {
    const expired = await placeOrder(ctx, buyer, [[product, 3]]);
    const fresh = await placeOrder(ctx, buyer, [[product, 2]]);

    await backdate(expired, AUTO_CANCEL_DAYS + 1);
    expect(await stock()).toBe(STOCK - 5);

    await expect(run()).resolves.toBe(true);

    const cancelled = await adminView(expired.code);

    expect(cancelled.status).toBe(OrderStatus.Cancelled);
    expect(cancelled.statusHistory.at(-1)).toMatchObject({
      fromStatus: OrderStatus.Pending,
      toStatus: OrderStatus.Cancelled,
      changedBy: null,
    });
    expect((await adminView(fresh.code)).status).toBe(OrderStatus.Pending);
    expect(await stock()).toBe(STOCK - 2);
  });

  it('emails the customer why the order was cancelled', async () => {
    const expired = await placeOrder(ctx, buyer, [[product, 1]]);

    await backdate(expired, AUTO_CANCEL_DAYS + 1);
    await run();

    expect(
      ctx.mail
        .sentTo(buyer.user.email, MAIL_JOB.OrderAutoCancelled)
        .map(({ payload }) => payload),
    ).toEqual([
      expect.objectContaining({
        orderCode: expired.code,
        days: AUTO_CANCEL_DAYS,
        fullName: 'Lanh Hung Son',
      }),
    ]);
  });

  it('leaves a confirmed order alone, however old', async () => {
    const confirmed = await placeOrder(ctx, buyer, [[product, 4]]);

    await changeStatus(ctx, admin, confirmed.code, {
      status: OrderStatus.Confirmed,
    }).expect(200);
    await backdate(confirmed, AUTO_CANCEL_DAYS * 3);
    await run();

    expect((await adminView(confirmed.code)).status).toBe(
      OrderStatus.Confirmed,
    );
    expect(await stock()).toBe(STOCK - 4);
  });

  it('leaves alone an order the customer has paid for', async () => {
    const paid = await placeOrder(
      ctx,
      buyer,
      [[product, 2]],
      PaymentMethod.BankTransfer,
    );

    await actingAs(ctx, buyer)
      .post(`${ORDERS_PATH}/${paid.code}/payment`)
      .send({ payment: { transactionRef: 'TXN-AUTO-CANCEL' } })
      .expect(200);
    await backdate(paid, AUTO_CANCEL_DAYS + 1);
    await run();

    expect((await adminView(paid.code)).status).toBe(OrderStatus.Pending);
    expect(await stock()).toBe(STOCK - 2);
  });

  it('releases its lock, so the next hour runs again', async () => {
    await expect(run()).resolves.toBe(true);
    await expect(run()).resolves.toBe(true);
  });

  it('keeps an order just short of the delay', async () => {
    const recent = await placeOrder(ctx, buyer, [[product, 1]]);

    await backdate(recent, AUTO_CANCEL_DAYS - 1);
    await run();

    expect((await adminView(recent.code)).status).toBe(OrderStatus.Pending);
  });

  it('does nothing while another instance holds the lock', async () => {
    const expired = await placeOrder(ctx, buyer, [[product, 1]]);

    await backdate(expired, AUTO_CANCEL_DAYS + 1);
    await ctx.app
      .get<Redis>(REDIS_CLIENT)
      .set(`lock:${SCHEDULED_JOBS.OrdersAutoCancel}`, 'other', 'EX', 60);

    await expect(run()).resolves.toBe(false);
    expect((await adminView(expired.code)).status).toBe(OrderStatus.Pending);
  });
});
