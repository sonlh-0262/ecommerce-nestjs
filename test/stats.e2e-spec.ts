import Redis from 'ioredis';
import request from 'supertest';

import { SCHEDULED_JOBS } from '../src/common/constants/scheduled-jobs';
import { MAIL_JOB } from '../src/mail/mail.constants';
import { OrderStatus } from '../src/orders/enums/order-status.enum';
import { Product } from '../src/products/entities/product.entity';
import { ProductStatus } from '../src/products/enums/product-status.enum';
import { REDIS_CLIENT } from '../src/redis/redis.constants';
import {
  BestSellersResponseDto,
  RevenueResponseDto,
  StatsOverviewResponseDto,
} from '../src/stats/dto/stats.dto';
import { MonthlyReportScheduler } from '../src/stats/monthly-report.scheduler';
import { User } from '../src/users/entities/user.entity';
import { UserRole } from '../src/users/enums/user-role.enum';
import { UserStatus } from '../src/users/enums/user-status.enum';
import { errorMessages } from './support/http';
import { SeededUser } from './support/interfaces/seeded-user.interface';
import { TestContext } from './support/interfaces/test-context.interface';
import { actingAs } from './support/shopper';
import { createTestApp } from './support/test-app';
import { ADMIN_STATS_PATHS } from './support/test.constants';
import { DEFAULT_SHIPPING_FEE as SHIPPING_FEE } from '../src/config/config.constants';

const FIRST_HALF_OF_2026 =
  'from=2026-01-01T00:00:00%2B07:00&to=2026-07-01T00:00:00%2B07:00';

describe('Admin statistics (e2e)', () => {
  let ctx: TestContext;
  let admin: SeededUser;
  let customer: SeededUser;
  let shirt: Product;
  let jeans: Product;
  let hat: Product;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  beforeEach(async () => {
    admin = await ctx.users.createAuthenticated({ role: UserRole.Admin });
    customer = await ctx.users.createAuthenticated();

    const category = await ctx.catalog.category();

    shirt = await ctx.catalog.product(category, { price: 200_000 });
    jeans = await ctx.catalog.product(category, { price: 500_000 });
    hat = await ctx.catalog.product(category, { price: 100_000 });
  });

  afterEach(async () => {
    await ctx.reset();
  });

  const delivered = (
    product: Product,
    deliveredAt: string,
    { quantity = 1, createdAt = deliveredAt } = {},
  ) =>
    ctx.orders.order(customer.user, product, {
      quantity,
      status: OrderStatus.Delivered,
      deliveredAt: new Date(deliveredAt),
      createdAt: new Date(createdAt),
    });

  const placed = (product: Product, status: OrderStatus, createdAt: string) =>
    ctx.orders.order(customer.user, product, {
      status,
      createdAt: new Date(createdAt),
    });

  const archive = (product: Product) =>
    ctx.dataSource.getRepository(Product).update(product.id, {
      status: ProductStatus.Archived,
      deletedAt: new Date(),
    });

  const asAdmin = () => actingAs(ctx, admin);

  describe('GET /admin/stats/overview', () => {
    it('counts revenue from delivered orders only, by delivery date', async () => {
      await delivered(shirt, '2026-02-10T03:00:00Z', {
        quantity: 2,
        createdAt: '2025-12-20T03:00:00Z',
      });
      await delivered(jeans, '2025-12-28T03:00:00Z');
      await placed(hat, OrderStatus.Cancelled, '2026-03-01T03:00:00Z');
      await placed(hat, OrderStatus.Pending, '2026-04-01T03:00:00Z');

      const response = await asAdmin()
        .get(`${ADMIN_STATS_PATHS.overview}?${FIRST_HALF_OF_2026}`)
        .expect(200);

      expect((response.body as StatsOverviewResponseDto).stats).toEqual({
        totalRevenue: 2 * 200_000 + SHIPPING_FEE,
        deliveredOrders: 1,
        totalOrders: 2,
        totalProducts: 3,
        totalUsers: 1,
        newUsers: 0,
        ordersByStatus: {
          PENDING: 1,
          CONFIRMED: 0,
          SHIPPING: 0,
          DELIVERED: 0,
          CANCELLED: 1,
          REJECTED: 0,
        },
      });
    });

    it('leaves deleted products and accounts out of the totals', async () => {
      await archive(hat);
      await ctx.dataSource.getRepository(User).softDelete(customer.user.id);
      await ctx.users.create({
        status: UserStatus.Pending,
        emailVerifiedAt: null,
      });

      const response = await asAdmin()
        .get(ADMIN_STATS_PATHS.overview)
        .expect(200);

      expect((response.body as StatsOverviewResponseDto).stats).toMatchObject({
        totalProducts: 2,
        totalUsers: 1,
        newUsers: 1,
      });
    });

    it('answers from the cache for the same range', async () => {
      const path = `${ADMIN_STATS_PATHS.overview}?${FIRST_HALF_OF_2026}`;

      await asAdmin().get(path).expect(200);
      await delivered(shirt, '2026-03-01T03:00:00Z');

      const response = await asAdmin().get(path).expect(200);

      expect(
        (response.body as StatsOverviewResponseDto).stats.deliveredOrders,
      ).toBe(0);
    });

    it.each([
      ['en', 'The start of the range must not be after its end'],
      ['vi', 'Thời điểm bắt đầu không được sau thời điểm kết thúc'],
    ])('refuses a reversed range with 422 in %s', async (lang, message) => {
      const response = await asAdmin()
        .get(
          `${ADMIN_STATS_PATHS.overview}?from=2026-07-01T00:00:00Z&to=2026-01-01T00:00:00Z&lang=${lang}`,
        )
        .expect(422);

      expect(errorMessages(response.body)).toEqual([message]);
    });

    it.each(['yesterday', '20260101', '2026-W01-1', '2026-01-01T00:00:00'])(
      'refuses the date %p',
      async (from) => {
        await asAdmin()
          .get(`${ADMIN_STATS_PATHS.overview}?from=${from}`)
          .expect(400);
      },
    );
  });

  describe('GET /admin/stats/best-sellers', () => {
    it('adds up a product over every delivered order and keeps a deleted one', async () => {
      await delivered(shirt, '2026-02-01T03:00:00Z', { quantity: 2 });
      await delivered(shirt, '2026-03-01T03:00:00Z', { quantity: 3 });
      await delivered(jeans, '2026-03-05T03:00:00Z', { quantity: 1 });
      await placed(hat, OrderStatus.Pending, '2026-03-05T03:00:00Z');
      await archive(jeans);

      const response = await asAdmin()
        .get(`${ADMIN_STATS_PATHS.bestSellers}?${FIRST_HALF_OF_2026}`)
        .expect(200);

      expect(response.body as BestSellersResponseDto).toEqual({
        products: [
          {
            id: shirt.id,
            name: shirt.name,
            slug: shirt.slug,
            isDeleted: false,
            thumbnailUrl: null,
            soldQuantity: 5,
            revenue: 5 * 200_000,
          },
          {
            id: jeans.id,
            name: jeans.name,
            slug: jeans.slug,
            isDeleted: true,
            thumbnailUrl: null,
            soldQuantity: 1,
            revenue: 500_000,
          },
        ],
        productsCount: 2,
      });
    });

    it('counts every product sold even past the limit', async () => {
      await delivered(shirt, '2026-02-01T03:00:00Z', { quantity: 2 });
      await delivered(jeans, '2026-02-02T03:00:00Z');

      const response = await asAdmin()
        .get(`${ADMIN_STATS_PATHS.bestSellers}?${FIRST_HALF_OF_2026}&limit=1`)
        .expect(200);
      const body = response.body as BestSellersResponseDto;

      expect(body.products.map(({ id }) => id)).toEqual([shirt.id]);
      expect(body.productsCount).toBe(2);
    });

    it('caps the limit at 50', async () => {
      await asAdmin()
        .get(`${ADMIN_STATS_PATHS.bestSellers}?limit=51`)
        .expect(400);
    });
  });

  describe('GET /admin/stats/revenue', () => {
    it('lists the twelve months of the year, empty ones at 0', async () => {
      await delivered(shirt, '2026-02-10T03:00:00Z', { quantity: 2 });
      await delivered(jeans, '2026-03-31T18:00:00Z');
      await delivered(hat, '2025-12-31T16:59:59Z');

      const response = await asAdmin()
        .get(`${ADMIN_STATS_PATHS.revenue}?groupBy=month&year=2026`)
        .expect(200);
      const { revenue } = response.body as RevenueResponseDto;
      const byPeriod = Object.fromEntries(
        revenue.series.map(({ period, ...point }) => [period, point]),
      );

      expect(revenue.series.map(({ period }) => period)).toEqual([
        '2026-01',
        '2026-02',
        '2026-03',
        '2026-04',
        '2026-05',
        '2026-06',
        '2026-07',
        '2026-08',
        '2026-09',
        '2026-10',
        '2026-11',
        '2026-12',
      ]);
      expect(byPeriod['2026-01']).toEqual({ orders: 0, revenue: 0 });
      expect(byPeriod['2026-02']).toEqual({
        orders: 1,
        revenue: 400_000 + SHIPPING_FEE,
      });
      expect(byPeriod['2026-03']).toEqual({ orders: 0, revenue: 0 });
      expect(byPeriod['2026-04']).toEqual({
        orders: 1,
        revenue: 500_000 + SHIPPING_FEE,
      });
      expect(revenue.total).toBe(900_000 + 2 * SHIPPING_FEE);
    });

    it('lists the five years ending with the one asked for', async () => {
      await delivered(shirt, '2024-06-01T03:00:00Z');
      await delivered(jeans, '2026-01-01T03:00:00Z');

      const response = await asAdmin()
        .get(`${ADMIN_STATS_PATHS.revenue}?groupBy=year&year=2026`)
        .expect(200);

      expect((response.body as RevenueResponseDto).revenue).toEqual({
        groupBy: 'year',
        total: 700_000 + 2 * SHIPPING_FEE,
        series: [
          { period: '2022', orders: 0, revenue: 0 },
          { period: '2023', orders: 0, revenue: 0 },
          { period: '2024', orders: 1, revenue: 200_000 + SHIPPING_FEE },
          { period: '2025', orders: 0, revenue: 0 },
          { period: '2026', orders: 1, revenue: 500_000 + SHIPPING_FEE },
        ],
      });
    });

    it.each(['', 'groupBy=week', 'groupBy=month&year=1999'])(
      'refuses the query %p',
      async (query) => {
        await asAdmin()
          .get(`${ADMIN_STATS_PATHS.revenue}?${query}`)
          .expect(400);
      },
    );
  });

  it.each(Object.values(ADMIN_STATS_PATHS))(
    'keeps %s from a customer',
    async (path) => {
      await actingAs(ctx, customer).get(path).expect(403);
      await request(ctx.server()).get(path).expect(401);
    },
  );

  describe('monthly revenue report', () => {
    const OCTOBER_1_IN_HANOI = new Date('2026-09-30T17:00:00.000Z');

    it('emails every active admin the figures of the month that ended', async () => {
      await ctx.users.create({
        role: UserRole.Admin,
        status: UserStatus.Inactive,
      });
      await delivered(shirt, '2026-09-10T03:00:00Z', { quantity: 3 });
      await delivered(jeans, '2026-09-30T16:00:00Z');
      await delivered(hat, '2026-08-15T03:00:00Z');
      await delivered(hat, '2026-09-30T17:30:00Z');

      await expect(
        ctx.app
          .get(MonthlyReportScheduler)
          .sendLastMonthReport(OCTOBER_1_IN_HANOI),
      ).resolves.toBe(true);

      const mails = ctx.mail.sent.filter(
        ({ name }) => name === MAIL_JOB.MonthlyRevenueReport,
      );

      expect(mails).toHaveLength(1);
      expect(mails[0].payload).toMatchObject({
        to: admin.user.email,
        year: 2026,
        month: 9,
        current: { orders: 2, revenue: 1_100_000 + 2 * SHIPPING_FEE },
        previous: { orders: 1, revenue: 100_000 + SHIPPING_FEE },
        topProducts: [
          { name: shirt.name, soldQuantity: 3, revenue: 600_000 },
          { name: jeans.name, soldQuantity: 1, revenue: 500_000 },
        ],
      });
    });

    it('sends a month once when two instances tick', async () => {
      const scheduler = ctx.app.get(MonthlyReportScheduler);

      await expect(
        scheduler.sendScheduledReport(OCTOBER_1_IN_HANOI),
      ).resolves.toBe(true);
      await expect(
        scheduler.sendScheduledReport(OCTOBER_1_IN_HANOI),
      ).resolves.toBe(false);

      expect(
        ctx.mail.sentTo(admin.user.email, MAIL_JOB.MonthlyRevenueReport),
      ).toHaveLength(1);
    });

    it('stays quiet while another instance holds the lock', async () => {
      await ctx.app
        .get<Redis>(REDIS_CLIENT)
        .set(`lock:${SCHEDULED_JOBS.MonthlyRevenueReport}`, 'other', 'EX', 60);

      await expect(
        ctx.app
          .get(MonthlyReportScheduler)
          .sendLastMonthReport(OCTOBER_1_IN_HANOI),
      ).resolves.toBe(false);
      expect(ctx.mail.sent).toHaveLength(0);
    });
  });
});
