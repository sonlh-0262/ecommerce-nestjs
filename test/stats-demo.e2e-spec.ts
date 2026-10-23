import request from 'supertest';

import { AuthenticatedUserResponseDto } from '../src/auth/dto/authenticated-user.dto';
import { ConsoleModule } from '../src/console/console.module';
import { DemoDataSeeder } from '../src/console/seeders/demo-data.seeder';
import { DEFAULT_SEED_ADMIN } from '../src/database/seeds/seed.constants';
import {
  BestSellersResponseDto,
  RevenueResponseDto,
  StatsOverviewResponseDto,
} from '../src/stats/dto/stats.dto';
import { bearer, loginRequest } from './support/http';
import { TestContext } from './support/interfaces/test-context.interface';
import { createTestApp } from './support/test-app';
import { ADMIN_STATS_PATHS } from './support/test.constants';

const ALL_TIME = 'from=2000-01-01T00:00:00Z&to=2100-01-01T00:00:00Z';
const SEED_TIMEOUT_MS = 120_000;
const DEMO_REVENUE = 127_137_000;

describe('Admin statistics on seed:demo (e2e)', () => {
  let ctx: TestContext;
  let token: string;

  beforeAll(async () => {
    ctx = await createTestApp({ module: ConsoleModule });
    await ctx.reset();
    await ctx.app.get(DemoDataSeeder).seed();

    const response = await loginRequest(
      ctx.server(),
      DEFAULT_SEED_ADMIN.email,
      DEFAULT_SEED_ADMIN.password,
    ).expect(200);

    token = (response.body as AuthenticatedUserResponseDto).user.token;
  }, SEED_TIMEOUT_MS);

  afterAll(async () => {
    await ctx.reset();
    await ctx.close();
  });

  const get = (path: string) =>
    request(ctx.server())
      .get(path)
      .set(...bearer(token))
      .expect(200);

  it('matches the figures of the demo data set', async () => {
    const response = await get(`${ADMIN_STATS_PATHS.overview}?${ALL_TIME}`);

    expect((response.body as StatsOverviewResponseDto).stats).toEqual({
      totalRevenue: DEMO_REVENUE,
      totalOrders: 20,
      deliveredOrders: 10,
      totalProducts: 50,
      totalUsers: 5,
      newUsers: 5,
      ordersByStatus: {
        PENDING: 2,
        CONFIRMED: 2,
        SHIPPING: 2,
        DELIVERED: 10,
        CANCELLED: 2,
        REJECTED: 2,
      },
    });
  });

  it('ranks the demo best sellers', async () => {
    const response = await get(
      `${ADMIN_STATS_PATHS.bestSellers}?${ALL_TIME}&limit=3`,
    );
    const { products, productsCount } = response.body as BestSellersResponseDto;

    expect(
      products.map(({ slug, soldQuantity, revenue }) => ({
        slug,
        soldQuantity,
        revenue,
      })),
    ).toEqual([
      { slug: 'bo-dao-inox-5-mon', soldQuantity: 4, revenue: 16_308_000 },
      { slug: 'sua-rua-mat-diu-nhe', soldQuantity: 4, revenue: 14_720_000 },
      { slug: 'quan-jean-nam-ong-dung', soldQuantity: 3, revenue: 13_500_000 },
    ]);
    expect(productsCount).toBe(23);
  });

  it('spreads the same revenue over the years, none missing', async () => {
    const response = await get(
      `${ADMIN_STATS_PATHS.revenue}?groupBy=year&year=${new Date().getFullYear()}`,
    );
    const { revenue } = response.body as RevenueResponseDto;

    expect(revenue.total).toBe(DEMO_REVENUE);
    expect(revenue.series).toHaveLength(5);
    expect(revenue.series.reduce((sum, { orders }) => sum + orders, 0)).toBe(
      10,
    );
  });
});
