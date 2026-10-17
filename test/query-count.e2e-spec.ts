import Redis from 'ioredis';
import request from 'supertest';

import { CacheService } from '../src/cache/cache.service';
import { CategoriesResponseDto } from '../src/categories/dto/category.dto';
import { Category } from '../src/categories/entities/category.entity';
import { CACHE_RESOURCES } from '../src/common/constants/cache-keys';
import { Product } from '../src/products/entities/product.entity';
import { REDIS_CLIENT } from '../src/redis/redis.constants';
import { UserRole } from '../src/users/enums/user-role.enum';
import { bearer } from './support/http';
import { SeededUser } from './support/interfaces/seeded-user.interface';
import { TestContext } from './support/interfaces/test-context.interface';
import { recordQueries } from './support/query-counter';
import { createTestApp } from './support/test-app';
import {
  ADMIN_CATEGORIES_PATH,
  ADMIN_ORDERS_PATH,
  ADMIN_USERS_PATH,
  CATEGORIES_PATH,
  ORDERS_PATH,
  PRODUCTS_PATH,
  productReviewsPath,
} from './support/test.constants';

type Caller = 'guest' | 'buyer' | 'admin';

interface ListEndpoint {
  name: string;
  path: () => string;
  caller: Caller;
  listKey: string;
  queries: number;
}

const SMALL_PAGE = 5;
const LARGE_PAGE = 50;
const ROWS = LARGE_PAGE + 1;

describe('Query counts and cache (e2e)', () => {
  let ctx: TestContext;
  let admin: SeededUser;
  let buyer: SeededUser;
  let category: Category;
  let reviewed: Product;

  beforeAll(async () => {
    ctx = await createTestApp();
    admin = await ctx.users.createAuthenticated({ role: UserRole.Admin });
    buyer = await ctx.users.createAuthenticated();

    const categories = await Promise.all(
      Array.from({ length: ROWS }, () => ctx.catalog.category()),
    );

    category = categories[0];

    const products = await Promise.all(
      Array.from({ length: ROWS }, (_value, index) =>
        ctx.catalog.product(categories[index], {
          name: `Áo thun đếm query ${index}`,
          isFeatured: true,
          soldCount: index,
        }),
      ),
    );

    reviewed = products[0];

    for (const product of products) {
      await ctx.orders.order(buyer.user, product);
      await ctx.orders.review(await ctx.users.create(), reviewed);
    }
  });

  afterAll(async () => {
    await ctx.reset();
    await ctx.close();
  });

  const tokens = (): Record<Caller, string | null> => ({
    guest: null,
    buyer: buyer.session.token,
    admin: admin.session.token,
  });

  const get = (path: string, caller: Caller = 'guest') => {
    const call = request(ctx.server()).get(path);
    const token = tokens()[caller];

    return token ? call.set(...bearer(token)) : call;
  };

  const invalidateCache = () =>
    ctx.app.get(CacheService).invalidate(...Object.values(CACHE_RESOURCES));

  const withLimit = (path: string, limit: number) =>
    `${path}${path.includes('?') ? '&' : '?'}limit=${limit}`;

  const measure = async (endpoint: ListEndpoint, limit: number) => {
    await invalidateCache();

    let rows = 0;
    const queries = await recordQueries(ctx.dataSource, async () => {
      const response = await get(
        withLimit(endpoint.path(), limit),
        endpoint.caller,
      ).expect(200);

      rows = (response.body as Record<string, unknown[]>)[endpoint.listKey]
        .length;
    });

    return { queries, rows };
  };

  const LIST_ENDPOINTS: ListEndpoint[] = [
    {
      name: 'GET /products',
      path: () => PRODUCTS_PATH,
      caller: 'guest',
      listKey: 'products',
      queries: 4,
    },
    {
      name: 'GET /products?q=',
      path: () => `${PRODUCTS_PATH}?q=ao%20thun`,
      caller: 'guest',
      listKey: 'products',
      queries: 4,
    },
    {
      name: 'GET /products?sort=best_selling',
      path: () => `${PRODUCTS_PATH}?sort=best_selling`,
      caller: 'guest',
      listKey: 'products',
      queries: 4,
    },
    {
      name: 'GET /products/featured',
      path: () => `${PRODUCTS_PATH}/featured`,
      caller: 'guest',
      listKey: 'products',
      queries: 4,
    },
    {
      name: 'GET /categories',
      path: () => CATEGORIES_PATH,
      caller: 'guest',
      listKey: 'categories',
      queries: 3,
    },
    {
      name: 'GET /orders',
      path: () => ORDERS_PATH,
      caller: 'buyer',
      listKey: 'orders',
      queries: 5,
    },
    {
      name: 'GET /admin/orders?status=PENDING',
      path: () => `${ADMIN_ORDERS_PATH}?status=PENDING`,
      caller: 'admin',
      listKey: 'orders',
      queries: 6,
    },
    {
      name: 'GET /products/:slug/reviews',
      path: () => productReviewsPath(reviewed.slug),
      caller: 'guest',
      listKey: 'reviews',
      queries: 6,
    },
    {
      name: 'GET /admin/users',
      path: () => ADMIN_USERS_PATH,
      caller: 'admin',
      listKey: 'users',
      queries: 4,
    },
  ];

  describe('no N+1 on list endpoints', () => {
    it.each(LIST_ENDPOINTS.map((endpoint) => [endpoint.name, endpoint]))(
      '%s runs as many queries for 50 rows as for 5',
      async (_name, endpoint) => {
        const small = await measure(endpoint, SMALL_PAGE);
        const large = await measure(endpoint, LARGE_PAGE);

        expect(small.rows).toBe(SMALL_PAGE);
        expect(large.rows).toBe(LARGE_PAGE);
        expect(small.queries).toHaveLength(endpoint.queries);
        expect(large.queries).toHaveLength(endpoint.queries);
      },
    );

    it('reads a user with their order statistics in a bounded number of queries', async () => {
      const queries = await recordQueries(ctx.dataSource, () =>
        get(`${ADMIN_USERS_PATH}/${buyer.user.id}`, 'admin').expect(200),
      );

      expect(queries).toHaveLength(4);
    });
  });

  describe('cache', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('serves the second GET /categories without touching the database', async () => {
      await invalidateCache();
      await get(CATEGORIES_PATH).expect(200);

      const queries = await recordQueries(ctx.dataSource, () =>
        get(CATEGORIES_PATH).expect(200),
      );

      expect(queries).toEqual([]);
    });

    it('shows an admin change on the next read', async () => {
      await get(CATEGORIES_PATH).expect(200);

      await request(ctx.server())
        .patch(`${ADMIN_CATEGORIES_PATH}/${category.id}`)
        .set(...bearer(admin.session.token))
        .send({ category: { name: 'Aaa đã đổi tên' } })
        .expect(200);

      const { categories } = (await get(CATEGORIES_PATH).expect(200))
        .body as CategoriesResponseDto;

      expect(categories.map(({ name }) => name)).toContain('Aaa đã đổi tên');
    });

    it('still answers 200 from the database when Redis is down', async () => {
      jest
        .spyOn(ctx.app.get<Redis>(REDIS_CLIENT), 'sendCommand')
        .mockImplementation(() =>
          Promise.reject(new Error('Connection is closed.')),
        );

      const queries = await recordQueries(ctx.dataSource, async () => {
        const { categories } = (await get(CATEGORIES_PATH).expect(200))
          .body as CategoriesResponseDto;

        expect(categories.length).toBeGreaterThan(0);
      });

      expect(queries.length).toBeGreaterThan(0);
    });
  });
});
