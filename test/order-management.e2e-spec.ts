import request from 'supertest';

import { Category } from '../src/categories/entities/category.entity';
import { MAIL_JOB } from '../src/mail/mail.constants';
import {
  AdminOrderResponseDto,
  AdminOrdersResponseDto,
} from '../src/orders/dto/admin-order.dto';
import { OrderResponseDto } from '../src/orders/dto/order.dto';
import { OrderStatus } from '../src/orders/enums/order-status.enum';
import { PaymentMethod } from '../src/orders/enums/payment-method.enum';
import { PaymentStatus } from '../src/orders/enums/payment-status.enum';
import { REASON_MIN_LENGTH } from '../src/orders/orders.constants';
import { Product } from '../src/products/entities/product.entity';
import { UserRole } from '../src/users/enums/user-role.enum';
import { errorMessages } from './support/http';
import { SeededUser } from './support/interfaces/seeded-user.interface';
import { TestContext } from './support/interfaces/test-context.interface';
import { actingAs, changeStatus, deliver, placeOrder } from './support/shopper';
import { createTestApp } from './support/test-app';
import { ADMIN_ORDERS_PATH, ORDERS_PATH } from './support/test.constants';

describe('Order management (e2e)', () => {
  const REASON = 'The shipping address is outside our delivery area';

  let ctx: TestContext;
  let category: Category;
  let admin: SeededUser;
  let buyer: SeededUser;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  beforeEach(async () => {
    category = await ctx.catalog.category();
    admin = await ctx.users.createAuthenticated({ role: UserRole.Admin });
    buyer = await ctx.users.createAuthenticated({ fullName: 'Lanh Hung Son' });
  });

  afterEach(async () => {
    await ctx.reset();
  });

  const orderOf = (body: unknown) => (body as AdminOrderResponseDto).order;

  const stockOf = async (product: Product) =>
    (
      await ctx.dataSource
        .getRepository(Product)
        .findOneByOrFail({ id: product.id })
    ).stock;

  const statusMails = () =>
    ctx.mail.sentTo(buyer.user.email, MAIL_JOB.OrderStatusChanged);

  const pendingOrder = async (
    paymentMethod: PaymentMethod = PaymentMethod.Cod,
  ) => {
    const product = await ctx.catalog.product(category, { stock: 10 });
    const order = await placeOrder(ctx, buyer, [[product, 3]], paymentMethod);

    return { product, order };
  };

  describe('access', () => {
    it('refuses a guest with 401', async () => {
      await request(ctx.server()).get(ADMIN_ORDERS_PATH).expect(401);
    });

    it('refuses a customer with 403 on every admin route', async () => {
      const { order } = await pendingOrder();
      const as = actingAs(ctx, buyer);

      await as.get(ADMIN_ORDERS_PATH).expect(403);
      await as.get(`${ADMIN_ORDERS_PATH}/${order.code}`).expect(403);
      await changeStatus(ctx, buyer, order.code, {
        status: OrderStatus.Confirmed,
      }).expect(403);
    });
  });

  describe('GET /admin/orders', () => {
    it("lists everyone's orders, newest first, with who placed them", async () => {
      const other = await ctx.users.createAuthenticated();
      const product = await ctx.catalog.product(category);
      const first = await placeOrder(ctx, buyer, [[product, 1]]);
      const second = await placeOrder(ctx, other, [[product, 2]]);

      const response = await actingAs(ctx, admin)
        .get(ADMIN_ORDERS_PATH)
        .expect(200);
      const body = response.body as AdminOrdersResponseDto;

      expect(body.ordersCount).toBe(2);
      expect(body.orders.map(({ code }) => code)).toEqual([
        second.code,
        first.code,
      ]);
      expect(body.orders[1]).toEqual({
        code: first.code,
        status: OrderStatus.Pending,
        paymentMethod: PaymentMethod.Cod,
        paymentStatus: PaymentStatus.Unpaid,
        total: first.total,
        createdAt: first.createdAt,
        itemsCount: 1,
        firstItemName: product.name,
        thumbnailUrl: null,
        user: {
          id: buyer.user.id,
          email: buyer.user.email,
          username: buyer.user.username,
          fullName: 'Lanh Hung Son',
        },
      });
    });

    it('filters on a code prefix, the account and the status', async () => {
      const other = await ctx.users.createAuthenticated();
      const product = await ctx.catalog.product(category);
      const mine = await placeOrder(ctx, buyer, [[product, 1]]);
      const theirs = await placeOrder(ctx, other, [[product, 1]]);
      await changeStatus(ctx, admin, theirs.code, {
        status: OrderStatus.Confirmed,
      }).expect(200);

      const codes = async (query: Record<string, string>) =>
        (
          (await actingAs(ctx, admin).get(ADMIN_ORDERS_PATH).query(query))
            .body as AdminOrdersResponseDto
        ).orders.map(({ code }) => code);

      expect(await codes({ code: mine.code.toLowerCase() })).toEqual([
        mine.code,
      ]);
      expect(await codes({ code: mine.code.slice(0, 12) })).toHaveLength(2);
      expect(await codes({ code: 'ORD-%' })).toEqual([]);
      expect(await codes({ userId: other.user.id })).toEqual([theirs.code]);
      expect(await codes({ status: OrderStatus.Confirmed })).toEqual([
        theirs.code,
      ]);
    });

    it('rejects a userId that is not a uuid with 400', async () => {
      await actingAs(ctx, admin)
        .get(ADMIN_ORDERS_PATH)
        .query({ userId: 'nope' })
        .expect(400);
    });
  });

  describe('GET /admin/orders/:code', () => {
    it("shows any customer's order with its customer and history", async () => {
      const { order } = await pendingOrder();

      const response = await actingAs(ctx, admin)
        .get(`${ADMIN_ORDERS_PATH}/${order.code}`)
        .expect(200);
      const detail = orderOf(response.body);

      expect(detail).toMatchObject({
        code: order.code,
        items: order.items,
        user: { id: buyer.user.id, email: buyer.user.email },
        statusHistory: [
          {
            fromStatus: null,
            toStatus: OrderStatus.Pending,
            changedBy: { id: buyer.user.id, username: buyer.user.username },
          },
        ],
      });
    });

    it('answers 404 for an unknown code, in Vietnamese on request', async () => {
      const response = await actingAs(ctx, admin)
        .get(`${ADMIN_ORDERS_PATH}/ORD-20000101-0001`)
        .query({ lang: 'vi' })
        .expect(404);

      expect(errorMessages(response.body)).toEqual(['Không tìm thấy đơn hàng']);
    });
  });

  describe('PATCH /admin/orders/:code/status', () => {
    it('confirms a pending order, which its customer then sees', async () => {
      const { order } = await pendingOrder();

      const response = await changeStatus(ctx, admin, order.code, {
        status: OrderStatus.Confirmed,
      }).expect(200);

      expect(orderOf(response.body).status).toBe(OrderStatus.Confirmed);

      const mine = await actingAs(ctx, buyer)
        .get(`${ORDERS_PATH}/${order.code}`)
        .expect(200);

      expect((mine.body as OrderResponseDto).order.status).toBe(
        OrderStatus.Confirmed,
      );
    });

    it('emails the customer exactly once on confirmation', async () => {
      const { order } = await pendingOrder();

      await changeStatus(ctx, admin, order.code, {
        status: OrderStatus.Confirmed,
      }).expect(200);

      expect(statusMails().map(({ payload }) => payload)).toEqual([
        {
          to: buyer.user.email,
          fullName: 'Lanh Hung Son',
          orderCode: order.code,
          status: OrderStatus.Confirmed,
          reason: null,
          lang: 'vi',
        },
      ]);
    });

    it('refuses to confirm twice with 422, so no second email goes out', async () => {
      const { order } = await pendingOrder();
      await changeStatus(ctx, admin, order.code, {
        status: OrderStatus.Confirmed,
      }).expect(200);

      const response = await changeStatus(ctx, admin, order.code, {
        status: OrderStatus.Confirmed,
      }).expect(422);

      expect(errorMessages(response.body)).toEqual([
        'Cannot change an order from CONFIRMED to CONFIRMED',
      ]);
      expect(statusMails()).toHaveLength(1);
    });

    it('refuses to skip from PENDING to SHIPPING with 422, in Vietnamese on request', async () => {
      const { order } = await pendingOrder();

      const response = await changeStatus(ctx, admin, order.code, {
        status: OrderStatus.Shipping,
      })
        .query({ lang: 'vi' })
        .expect(422);

      expect(errorMessages(response.body)).toEqual([
        'Không thể chuyển đơn hàng từ PENDING sang SHIPPING',
      ]);
    });

    it.each([OrderStatus.Cancelled, OrderStatus.Pending, 'LOST'])(
      'rejects %s, which an admin cannot set, with 400',
      async (status) => {
        const { order } = await pendingOrder();

        await changeStatus(ctx, admin, order.code, { status }).expect(400);
      },
    );

    it('answers 422 for a rejection without a reason', async () => {
      const { order } = await pendingOrder();

      const response = await changeStatus(ctx, admin, order.code, {
        status: OrderStatus.Rejected,
      }).expect(422);

      expect(errorMessages(response.body)).toEqual([
        `A reason of at least ${REASON_MIN_LENGTH} characters is required to reject an order`,
      ]);
    });

    it('answers 400 for a rejection reason one character short', async () => {
      const { order } = await pendingOrder();

      await changeStatus(ctx, admin, order.code, {
        status: OrderStatus.Rejected,
        reason: 'x'.repeat(REASON_MIN_LENGTH - 1),
      }).expect(400);
    });

    it('rejects with the reason, puts the stock back and emails it', async () => {
      const { product, order } = await pendingOrder();
      expect(await stockOf(product)).toBe(7);

      const response = await changeStatus(ctx, admin, order.code, {
        status: OrderStatus.Rejected,
        reason: REASON,
      }).expect(200);
      const detail = orderOf(response.body);

      expect(await stockOf(product)).toBe(10);
      expect(detail.status).toBe(OrderStatus.Rejected);
      expect(detail.reason).toBe(REASON);
      expect(detail.statusHistory.at(-1)).toMatchObject({
        fromStatus: OrderStatus.Pending,
        toStatus: OrderStatus.Rejected,
        reason: REASON,
        changedBy: { id: admin.user.id },
      });
      expect(statusMails().map(({ payload }) => payload)).toEqual([
        expect.objectContaining({
          status: OrderStatus.Rejected,
          reason: REASON,
        }),
      ]);
    });

    it('walks PENDING -> CONFIRMED -> SHIPPING -> DELIVERED and settles a COD order', async () => {
      const { order } = await pendingOrder(PaymentMethod.Cod);

      await deliver(ctx, admin, order.code);

      const response = await actingAs(ctx, admin)
        .get(`${ADMIN_ORDERS_PATH}/${order.code}`)
        .expect(200);
      const detail = orderOf(response.body);

      expect(detail.statusHistory.map(({ toStatus }) => toStatus)).toEqual([
        OrderStatus.Pending,
        OrderStatus.Confirmed,
        OrderStatus.Shipping,
        OrderStatus.Delivered,
      ]);
      expect(detail.status).toBe(OrderStatus.Delivered);
      expect(detail.deliveredAt).not.toBeNull();
      expect(detail.paymentStatus).toBe(PaymentStatus.Paid);
      expect(detail.paidAt).toBe(detail.deliveredAt);
    });

    it('leaves an unpaid bank transfer unpaid on delivery', async () => {
      const { order } = await pendingOrder(PaymentMethod.BankTransfer);

      await deliver(ctx, admin, order.code);

      const response = await actingAs(ctx, admin)
        .get(`${ADMIN_ORDERS_PATH}/${order.code}`)
        .expect(200);

      expect(orderOf(response.body)).toMatchObject({
        status: OrderStatus.Delivered,
        paymentStatus: PaymentStatus.Unpaid,
        paidAt: null,
      });
    });

    it('sends no email for shipping and delivery', async () => {
      const { order } = await pendingOrder();

      await deliver(ctx, admin, order.code);

      expect(statusMails().map(({ payload }) => payload.status)).toEqual([
        OrderStatus.Confirmed,
      ]);
    });

    it('refuses any change once DELIVERED with 422', async () => {
      const { order } = await pendingOrder();
      await deliver(ctx, admin, order.code);

      await changeStatus(ctx, admin, order.code, {
        status: OrderStatus.Rejected,
        reason: REASON,
      }).expect(422);
    });

    it('lets one of two concurrent confirmations through', async () => {
      const { order } = await pendingOrder();

      const statuses = (
        await Promise.all([
          changeStatus(ctx, admin, order.code, {
            status: OrderStatus.Confirmed,
          }),
          changeStatus(ctx, admin, order.code, {
            status: OrderStatus.Confirmed,
          }),
        ])
      )
        .map(({ status }) => status)
        .sort();

      expect(statuses).toEqual([200, 422]);
      expect(statusMails()).toHaveLength(1);
    });

    it('answers 404 for an unknown code', async () => {
      await changeStatus(ctx, admin, 'ORD-20000101-0001', {
        status: OrderStatus.Confirmed,
      }).expect(404);
    });
  });
});
