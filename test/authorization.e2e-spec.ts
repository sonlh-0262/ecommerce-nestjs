import request from 'supertest';

import { CartResponseDto } from '../src/cart/dto/cart.dto';
import { Category } from '../src/categories/entities/category.entity';
import { OrderStatus } from '../src/orders/enums/order-status.enum';
import { PaymentMethod } from '../src/orders/enums/payment-method.enum';
import {
  ProductImagesResponseDto,
  ProductResponseDto,
} from '../src/products/dto/product.dto';
import { Product } from '../src/products/entities/product.entity';
import { ProductStatus } from '../src/products/enums/product-status.enum';
import { ReviewResponseDto } from '../src/reviews/dto/review.dto';
import { UserRole } from '../src/users/enums/user-role.enum';
import { UserStatus } from '../src/users/enums/user-status.enum';
import { nextSequence } from './support/factories/sequence';
import { bearer } from './support/http';
import { PNG_IMAGE } from './support/images';
import { SeededUser } from './support/interfaces/seeded-user.interface';
import { TestContext } from './support/interfaces/test-context.interface';
import { registeredRoutes } from './support/routes';
import { actingAs, deliver, placeOrder } from './support/shopper';
import { createTestApp } from './support/test-app';
import {
  ADMIN_CATEGORIES_PATH,
  ADMIN_ORDERS_PATH,
  ADMIN_PRODUCTS_PATH,
  ADMIN_USERS_PATH,
  API_BASE_PATH,
  ATTACHMENTS_PATH,
  AUTH_PATHS,
  CART_PATHS,
  CATEGORIES_PATH,
  HEALTH_PATH,
  ORDERS_PATH,
  PRODUCTS_PATH,
  PROFILE_PATHS,
  REVIEWS_PATH,
  SEEDED_USER_PASSWORD,
  TEST_RECEIVER,
  productReviewsPath,
} from './support/test.constants';

type Actor = 'guest' | 'user' | 'admin';
type Account = Exclude<Actor, 'guest'>;
type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';

interface CaseRequest {
  path: string;
  body?: object;
  upload?: { field: string; contents: Buffer };
}

interface RouteCase {
  route: string;
  expected: Record<Actor, number>;
  build: (fixtures: Fixtures, account: Account) => Promise<CaseRequest>;
}

const ACTORS: readonly Actor[] = ['guest', 'user', 'admin'];
const ADMIN_PREFIX = `${API_BASE_PATH}/admin/`;
const STOCK = 50;

const open = (status = 200) => ({ guest: status, user: status, admin: status });
const signedIn = (status = 200) => ({
  guest: 401,
  user: status,
  admin: status,
});
const adminOnly = (status = 200) => ({ guest: 401, user: 403, admin: status });

class Fixtures {
  private readonly built = new Map<string, Promise<unknown>>();

  constructor(
    private readonly ctx: TestContext,
    readonly accounts: Record<Account, SeededUser>,
  ) {}

  category(): Promise<Category> {
    return this.once('category', () => this.ctx.catalog.category());
  }

  product(key: string): Promise<Product> {
    return this.once(`product:${key}`, async () =>
      this.ctx.catalog.product(await this.category(), { stock: STOCK }),
    );
  }

  draftWithImage(): Promise<{ productId: string; imageId: string }> {
    return this.once('draft-with-image', async () => {
      const product = await this.ctx.catalog.product(await this.category(), {
        status: ProductStatus.Draft,
      });
      const response = await actingAs(this.ctx, this.accounts.admin)
        .post(`${ADMIN_PRODUCTS_PATH}/${product.id}/images`)
        .attach('files', PNG_IMAGE, 'photo.png')
        .expect(201);
      const [image] = (response.body as ProductImagesResponseDto).images;

      return { productId: product.id, imageId: image.id };
    });
  }

  publicImageUrl(): Promise<string> {
    return this.once('public-image', async () => {
      const { productId } = await this.draftWithImage();
      const response = await actingAs(this.ctx, this.accounts.admin)
        .patch(`${ADMIN_PRODUCTS_PATH}/${productId}`)
        .send({ product: { status: ProductStatus.Published } })
        .expect(200);

      return (response.body as ProductResponseDto).product.images[0].url;
    });
  }

  cartItem(account: Account): Promise<string> {
    return this.once(`cart:${account}`, async () => {
      const response = await actingAs(this.ctx, this.accounts[account])
        .post(CART_PATHS.items)
        .send({
          item: { productId: (await this.product('cart')).id, quantity: 1 },
        })
        .expect(201);

      return (response.body as CartResponseDto).cart.items[0].id;
    });
  }

  pendingOrder(account: Account): Promise<string> {
    return this.once(`order:${account}`, async () => {
      const order = await placeOrder(
        this.ctx,
        this.accounts[account],
        [[await this.product('order'), 1]],
        PaymentMethod.BankTransfer,
      );

      return order.code;
    });
  }

  deliveredProduct(account: Account): Promise<Product> {
    return this.once(`delivered:${account}`, async () => {
      const product = await this.product(`delivered:${account}`);
      const order = await placeOrder(this.ctx, this.accounts[account], [
        [product, 1],
      ]);

      await deliver(this.ctx, this.accounts.admin, order.code);

      return product;
    });
  }

  review(account: Account): Promise<string> {
    return this.once(`review:${account}`, async () => {
      const product = await this.deliveredProduct(account);
      const response = await actingAs(this.ctx, this.accounts[account])
        .post(productReviewsPath(product.slug))
        .send({ review: { rating: 4, content: 'Đã nhận hàng, khá ổn.' } })
        .expect(201);

      return (response.body as ReviewResponseDto).review.id;
    });
  }

  private once<T>(key: string, build: () => Promise<T>): Promise<T> {
    if (!this.built.has(key)) {
      this.built.set(key, build());
    }

    return this.built.get(key) as Promise<T>;
  }
}

const at = (path: string) => () => Promise.resolve({ path });

const PUBLIC_ROUTES: RouteCase[] = [
  { route: `GET ${HEALTH_PATH}`, expected: open(), build: at(HEALTH_PATH) },
  {
    route: `GET ${CATEGORIES_PATH}`,
    expected: open(),
    build: at(CATEGORIES_PATH),
  },
  {
    route: `GET ${CATEGORIES_PATH}/:slug`,
    expected: open(),
    build: async (fx) => ({
      path: `${CATEGORIES_PATH}/${(await fx.category()).slug}`,
    }),
  },
  { route: `GET ${PRODUCTS_PATH}`, expected: open(), build: at(PRODUCTS_PATH) },
  {
    route: `GET ${PRODUCTS_PATH}/featured`,
    expected: open(),
    build: at(`${PRODUCTS_PATH}/featured`),
  },
  {
    route: `GET ${PRODUCTS_PATH}/:slug`,
    expected: open(),
    build: async (fx) => ({
      path: `${PRODUCTS_PATH}/${(await fx.product('public')).slug}`,
    }),
  },
  {
    route: `GET ${PRODUCTS_PATH}/:slug/reviews`,
    expected: open(),
    build: async (fx) => ({
      path: productReviewsPath((await fx.product('public')).slug),
    }),
  },
  {
    route: `GET ${ATTACHMENTS_PATH}/:id`,
    expected: open(),
    build: async (fx) => ({ path: await fx.publicImageUrl() }),
  },
];

const AUTH_ROUTES: RouteCase[] = [
  {
    route: `POST ${AUTH_PATHS.register}`,
    expected: open(201),
    build: () => {
      const sequence = nextSequence();

      return Promise.resolve({
        path: AUTH_PATHS.register,
        body: {
          user: {
            email: `matrix-${sequence}@example.com`,
            username: `matrix_${sequence}`,
            password: 'Matrix123',
          },
        },
      });
    },
  },
  {
    route: `POST ${AUTH_PATHS.verifyEmail}`,
    expected: open(422),
    build: () =>
      Promise.resolve({
        path: AUTH_PATHS.verifyEmail,
        body: { token: 'f'.repeat(64) },
      }),
  },
  {
    route: `POST ${AUTH_PATHS.resendVerification}`,
    expected: open(),
    build: (fx, account) =>
      Promise.resolve({
        path: AUTH_PATHS.resendVerification,
        body: { email: fx.accounts[account].user.email },
      }),
  },
  {
    route: `POST ${AUTH_PATHS.login}`,
    expected: open(),
    build: (fx, account) =>
      Promise.resolve({
        path: AUTH_PATHS.login,
        body: {
          user: {
            email: fx.accounts[account].user.email,
            password: SEEDED_USER_PASSWORD,
          },
        },
      }),
  },
  {
    route: `POST ${AUTH_PATHS.forgotPassword}`,
    expected: open(),
    build: (fx, account) =>
      Promise.resolve({
        path: AUTH_PATHS.forgotPassword,
        body: { email: fx.accounts[account].user.email },
      }),
  },
  {
    route: `POST ${AUTH_PATHS.resetPassword}`,
    expected: open(422),
    build: () =>
      Promise.resolve({
        path: AUTH_PATHS.resetPassword,
        body: { token: 'f'.repeat(64), password: 'Matrix123' },
      }),
  },
];

const SIGNED_IN_ROUTES: RouteCase[] = [
  {
    route: `POST ${AUTH_PATHS.logout}`,
    expected: signedIn(),
    build: at(AUTH_PATHS.logout),
  },
  {
    route: `GET ${PROFILE_PATHS.me}`,
    expected: signedIn(),
    build: at(PROFILE_PATHS.me),
  },
  {
    route: `PATCH ${PROFILE_PATHS.me}`,
    expected: signedIn(),
    build: () =>
      Promise.resolve({
        path: PROFILE_PATHS.me,
        body: { user: { fullName: 'Ma Trận' } },
      }),
  },
  {
    route: `PUT ${PROFILE_PATHS.password}`,
    expected: signedIn(),
    build: () =>
      Promise.resolve({
        path: PROFILE_PATHS.password,
        body: {
          user: {
            currentPassword: SEEDED_USER_PASSWORD,
            newPassword: 'Another123',
          },
        },
      }),
  },
  {
    route: `POST ${PROFILE_PATHS.avatar}`,
    expected: signedIn(),
    build: () =>
      Promise.resolve({
        path: PROFILE_PATHS.avatar,
        upload: { field: 'file', contents: PNG_IMAGE },
      }),
  },
  {
    route: `GET ${CART_PATHS.cart}`,
    expected: signedIn(),
    build: at(CART_PATHS.cart),
  },
  {
    route: `POST ${CART_PATHS.items}`,
    expected: signedIn(201),
    build: async (fx) => ({
      path: CART_PATHS.items,
      body: { item: { productId: (await fx.product('cart')).id, quantity: 1 } },
    }),
  },
  {
    route: `PATCH ${CART_PATHS.items}/:itemId`,
    expected: signedIn(),
    build: async (fx, account) => ({
      path: `${CART_PATHS.items}/${await fx.cartItem(account)}`,
      body: { item: { quantity: 2 } },
    }),
  },
  {
    route: `DELETE ${CART_PATHS.items}/:itemId`,
    expected: signedIn(204),
    build: async (fx, account) => ({
      path: `${CART_PATHS.items}/${await fx.cartItem(account)}`,
    }),
  },
  {
    route: `DELETE ${CART_PATHS.items}`,
    expected: signedIn(204),
    build: at(CART_PATHS.items),
  },
  {
    route: `POST ${ORDERS_PATH}`,
    expected: signedIn(201),
    build: async (fx, account) => {
      await fx.cartItem(account);

      return {
        path: ORDERS_PATH,
        body: {
          order: { ...TEST_RECEIVER, paymentMethod: PaymentMethod.Cod },
        },
      };
    },
  },
  { route: `GET ${ORDERS_PATH}`, expected: signedIn(), build: at(ORDERS_PATH) },
  {
    route: `GET ${ORDERS_PATH}/:code`,
    expected: signedIn(),
    build: async (fx, account) => ({
      path: `${ORDERS_PATH}/${await fx.pendingOrder(account)}`,
    }),
  },
  {
    route: `POST ${ORDERS_PATH}/:code/payment`,
    expected: signedIn(),
    build: async (fx, account) => ({
      path: `${ORDERS_PATH}/${await fx.pendingOrder(account)}/payment`,
      body: { payment: { transactionRef: `TXN-${account}` } },
    }),
  },
  {
    route: `POST ${ORDERS_PATH}/:code/cancel`,
    expected: signedIn(),
    build: async (fx, account) => ({
      path: `${ORDERS_PATH}/${await fx.pendingOrder(account)}/cancel`,
    }),
  },
  {
    route: `POST ${PRODUCTS_PATH}/:slug/reviews`,
    expected: signedIn(201),
    build: async (fx, account) => ({
      path: productReviewsPath((await fx.deliveredProduct(account)).slug),
      body: { review: { rating: 5, content: 'Rất hài lòng với sản phẩm.' } },
    }),
  },
  {
    route: `PATCH ${REVIEWS_PATH}/:id`,
    expected: signedIn(),
    build: async (fx, account) => ({
      path: `${REVIEWS_PATH}/${await fx.review(account)}`,
      body: { review: { rating: 3 } },
    }),
  },
  {
    route: `DELETE ${REVIEWS_PATH}/:id`,
    expected: signedIn(204),
    build: async (fx, account) => ({
      path: `${REVIEWS_PATH}/${await fx.review(account)}`,
    }),
  },
];

const ADMIN_ROUTES: RouteCase[] = [
  {
    route: `GET ${ADMIN_USERS_PATH}`,
    expected: adminOnly(),
    build: at(ADMIN_USERS_PATH),
  },
  {
    route: `GET ${ADMIN_USERS_PATH}/:id`,
    expected: adminOnly(),
    build: (fx) =>
      Promise.resolve({
        path: `${ADMIN_USERS_PATH}/${fx.accounts.user.user.id}`,
      }),
  },
  {
    route: `PATCH ${ADMIN_USERS_PATH}/:id/status`,
    expected: adminOnly(),
    build: (fx) =>
      Promise.resolve({
        path: `${ADMIN_USERS_PATH}/${fx.accounts.user.user.id}/status`,
        body: { user: { status: UserStatus.Inactive } },
      }),
  },
  {
    route: `POST ${ADMIN_CATEGORIES_PATH}`,
    expected: adminOnly(201),
    build: () =>
      Promise.resolve({
        path: ADMIN_CATEGORIES_PATH,
        body: { category: { name: 'Danh mục ma trận' } },
      }),
  },
  {
    route: `PATCH ${ADMIN_CATEGORIES_PATH}/:id`,
    expected: adminOnly(),
    build: async (fx) => ({
      path: `${ADMIN_CATEGORIES_PATH}/${(await fx.category()).id}`,
      body: { category: { name: 'Đổi tên' } },
    }),
  },
  {
    route: `DELETE ${ADMIN_CATEGORIES_PATH}/:id`,
    expected: adminOnly(204),
    build: async (fx) => ({
      path: `${ADMIN_CATEGORIES_PATH}/${(await fx.category()).id}`,
    }),
  },
  {
    route: `GET ${ADMIN_PRODUCTS_PATH}`,
    expected: adminOnly(),
    build: at(ADMIN_PRODUCTS_PATH),
  },
  {
    route: `POST ${ADMIN_PRODUCTS_PATH}`,
    expected: adminOnly(201),
    build: async (fx) => ({
      path: ADMIN_PRODUCTS_PATH,
      body: {
        product: {
          name: 'Sản phẩm ma trận',
          price: 100_000,
          stock: 1,
          categoryId: (await fx.category()).id,
        },
      },
    }),
  },
  {
    route: `PATCH ${ADMIN_PRODUCTS_PATH}/:id`,
    expected: adminOnly(),
    build: async (fx) => ({
      path: `${ADMIN_PRODUCTS_PATH}/${(await fx.product('admin')).id}`,
      body: { product: { price: 120_000 } },
    }),
  },
  {
    route: `DELETE ${ADMIN_PRODUCTS_PATH}/:id`,
    expected: adminOnly(204),
    build: async (fx) => ({
      path: `${ADMIN_PRODUCTS_PATH}/${(await fx.product('admin')).id}`,
    }),
  },
  {
    route: `POST ${ADMIN_PRODUCTS_PATH}/:id/images`,
    expected: adminOnly(201),
    build: async (fx) => ({
      path: `${ADMIN_PRODUCTS_PATH}/${(await fx.product('admin')).id}/images`,
      upload: { field: 'files', contents: PNG_IMAGE },
    }),
  },
  {
    route: `DELETE ${ADMIN_PRODUCTS_PATH}/:id/images/:imageId`,
    expected: adminOnly(204),
    build: async (fx) => {
      const { productId, imageId } = await fx.draftWithImage();

      return {
        path: `${ADMIN_PRODUCTS_PATH}/${productId}/images/${imageId}`,
      };
    },
  },
  {
    route: `GET ${ADMIN_ORDERS_PATH}`,
    expected: adminOnly(),
    build: at(ADMIN_ORDERS_PATH),
  },
  {
    route: `GET ${ADMIN_ORDERS_PATH}/:code`,
    expected: adminOnly(),
    build: async (fx) => ({
      path: `${ADMIN_ORDERS_PATH}/${await fx.pendingOrder('user')}`,
    }),
  },
  {
    route: `PATCH ${ADMIN_ORDERS_PATH}/:code/status`,
    expected: adminOnly(),
    build: async (fx) => ({
      path: `${ADMIN_ORDERS_PATH}/${await fx.pendingOrder('user')}/status`,
      body: { order: { status: OrderStatus.Confirmed } },
    }),
  },
];

const ALL_ROUTES = [
  ...PUBLIC_ROUTES,
  ...AUTH_ROUTES,
  ...SIGNED_IN_ROUTES,
  ...ADMIN_ROUTES,
];

describe('Authorization matrix (e2e)', () => {
  let ctx: TestContext;
  let fixtures: Fixtures;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  beforeEach(async () => {
    fixtures = new Fixtures(ctx, {
      user: await ctx.users.createAuthenticated(),
      admin: await ctx.users.createAuthenticated({ role: UserRole.Admin }),
    });
  });

  afterEach(async () => {
    await ctx.reset();
  });

  const send = (
    actor: Actor,
    method: Method,
    { path, body, upload }: CaseRequest,
  ) => {
    let call = request(ctx.server())[method](path);

    if (actor !== 'guest') {
      call = call.set(...bearer(fixtures.accounts[actor].session.token));
    }

    if (upload) {
      return call.attach(upload.field, upload.contents, 'matrix.png');
    }

    return body ? call.send(body) : call;
  };

  const statusesFor = async ({ route, build }: RouteCase) => {
    const method = route.split(' ')[0].toLowerCase() as Method;
    const statuses: Partial<Record<Actor, number>> = {};

    for (const actor of ACTORS) {
      const account: Account = actor === 'admin' ? 'admin' : 'user';
      const { status } = await send(
        actor,
        method,
        await build(fixtures, account),
      );

      statuses[actor] = status;
    }

    return statuses;
  };

  it('covers every route the application registers', () => {
    const tested = ALL_ROUTES.map(({ route }) => route);

    expect([...registeredRoutes(ctx.app)].sort()).toEqual([...tested].sort());
  });

  it('puts every /admin route in the admin table', () => {
    const adminRoutes = registeredRoutes(ctx.app).filter((route) =>
      route.split(' ')[1].startsWith(ADMIN_PREFIX),
    );

    expect(adminRoutes.sort()).toEqual(
      ADMIN_ROUTES.map(({ route }) => route).sort(),
    );
  });

  describe.each([
    ['public', PUBLIC_ROUTES],
    ['auth', AUTH_ROUTES],
    ['signed-in', SIGNED_IN_ROUTES],
    ['admin', ADMIN_ROUTES],
  ])('%s routes', (_group, cases) => {
    it.each(cases.map((routeCase) => [routeCase.route, routeCase] as const))(
      '%s',
      async (_route, routeCase) => {
        expect(await statusesFor(routeCase)).toEqual(routeCase.expected);
      },
    );
  });

  describe('account state', () => {
    it('answers 403, not 401, to a pending account', async () => {
      const pending = await ctx.users.createAuthenticated({
        status: UserStatus.Pending,
        emailVerifiedAt: null,
      });

      await actingAs(ctx, pending).get(PROFILE_PATHS.me).expect(403);
    });

    it('locks out a token the moment an admin deactivates its account', async () => {
      const { user, admin } = fixtures.accounts;

      await actingAs(ctx, user).get(PROFILE_PATHS.me).expect(200);
      await actingAs(ctx, admin)
        .patch(`${ADMIN_USERS_PATH}/${user.user.id}/status`)
        .send({ user: { status: UserStatus.Inactive } })
        .expect(200);

      await actingAs(ctx, user).get(PROFILE_PATHS.me).expect(403);
    });
  });

  describe("another user's resources", () => {
    let stranger: SeededUser;

    beforeEach(async () => {
      stranger = await ctx.users.createAuthenticated();
    });

    it('hides their order', async () => {
      const code = await fixtures.pendingOrder('user');

      await actingAs(ctx, stranger).get(`${ORDERS_PATH}/${code}`).expect(404);
    });

    it('hides their review', async () => {
      const id = await fixtures.review('user');

      await actingAs(ctx, stranger)
        .patch(`${REVIEWS_PATH}/${id}`)
        .send({ review: { rating: 1 } })
        .expect(404);
    });

    it('hides their cart item', async () => {
      const id = await fixtures.cartItem('user');

      await actingAs(ctx, stranger)
        .patch(`${CART_PATHS.items}/${id}`)
        .send({ item: { quantity: 2 } })
        .expect(404);
    });
  });
});
