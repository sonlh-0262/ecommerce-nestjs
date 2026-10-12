import request from 'supertest';

import { CartResponseDto } from '../src/cart/dto/cart.dto';
import { Category } from '../src/categories/entities/category.entity';
import { DEFAULT_SHIPPING_FEE as SHIPPING_FEE } from '../src/config/config.constants';
import { MAIL_JOB } from '../src/mail/mail.constants';
import {
  ItemsUnavailableErrorDto,
  OrderResponseDto,
  OrdersResponseDto,
} from '../src/orders/dto/order.dto';
import { OrderStatus } from '../src/orders/enums/order-status.enum';
import { PaymentMethod } from '../src/orders/enums/payment-method.enum';
import { PaymentStatus } from '../src/orders/enums/payment-status.enum';
import { Product } from '../src/products/entities/product.entity';
import { ProductStatus } from '../src/products/enums/product-status.enum';
import { UserRole } from '../src/users/enums/user-role.enum';
import { bearer, errorMessages } from './support/http';
import { SeededUser } from './support/interfaces/seeded-user.interface';
import { TestContext } from './support/interfaces/test-context.interface';
import { createTestApp } from './support/test-app';
import {
  ADMIN_PRODUCTS_PATH,
  CART_PATHS,
  ORDERS_PATH,
} from './support/test.constants';

const ORDER_CODE_PATTERN = /^ORD-\d{8}-\d{4}$/;

describe('Cart and checkout (e2e)', () => {
  let ctx: TestContext;
  let category: Category;
  let buyer: SeededUser;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  beforeEach(async () => {
    category = await ctx.catalog.category();
    buyer = await ctx.users.createAuthenticated();
  });

  afterEach(async () => {
    await ctx.reset();
  });

  const as = ({ session }: SeededUser) => ({
    get: (url: string) =>
      request(ctx.server())
        .get(url)
        .set(...bearer(session.token)),
    post: (url: string) =>
      request(ctx.server())
        .post(url)
        .set(...bearer(session.token)),
    patch: (url: string) =>
      request(ctx.server())
        .patch(url)
        .set(...bearer(session.token)),
    delete: (url: string) =>
      request(ctx.server())
        .delete(url)
        .set(...bearer(session.token)),
  });

  const addToCart = (user: SeededUser, productId: string, quantity: number) =>
    as(user).post(CART_PATHS.items).send({ item: { productId, quantity } });

  const placeOrder = (
    user: SeededUser,
    paymentMethod: PaymentMethod = PaymentMethod.Cod,
  ) =>
    as(user)
      .post(ORDERS_PATH)
      .send({
        order: {
          receiverName: 'Lanh Hung Son',
          receiverPhone: '0901 234 567',
          shippingAddress: '1 Nguyen Trai, Ha Noi',
          paymentMethod,
        },
      });

  const stockOf = async (product: Product) =>
    (
      await ctx.dataSource
        .getRepository(Product)
        .findOneOrFail({ where: { id: product.id }, withDeleted: true })
    ).stock;

  const orderOf = (body: unknown) => (body as OrderResponseDto).order;
  const cartOf = (body: unknown) => (body as CartResponseDto).cart;

  const orderedWith = async (
    product: Product,
    quantity: number,
    paymentMethod?: PaymentMethod,
  ) => {
    await addToCart(buyer, product.id, quantity).expect(201);

    return orderOf((await placeOrder(buyer, paymentMethod).expect(201)).body);
  };

  describe('cart', () => {
    it('refuses a guest with 401', async () => {
      await request(ctx.server()).get(CART_PATHS.cart).expect(401);
    });

    it('answers an empty cart before the first item', async () => {
      const response = await as(buyer).get(CART_PATHS.cart).expect(200);

      expect(response.body).toEqual({
        cart: { items: [], itemsCount: 0, subtotal: 0 },
      });
    });

    it('adds up the quantity when the same product is added twice', async () => {
      const product = await ctx.catalog.product(category, {
        price: 150000,
        salePrice: 120000,
      });

      await addToCart(buyer, product.id, 2).expect(201);
      const response = await addToCart(buyer, product.id, 3).expect(201);

      expect(cartOf(response.body)).toEqual({
        items: [
          {
            id: expect.any(String) as string,
            productId: product.id,
            name: product.name,
            slug: product.slug,
            thumbnailUrl: null,
            unitPrice: 120000,
            quantity: 5,
            lineTotal: 600000,
            stock: 10,
            available: true,
          },
        ],
        itemsCount: 1,
        subtotal: 600000,
      });
    });

    it('answers 409 with the stock left when the cart would exceed it', async () => {
      const product = await ctx.catalog.product(category, { stock: 3 });

      await addToCart(buyer, product.id, 2).expect(201);
      const response = await addToCart(buyer, product.id, 2).expect(409);

      expect(response.body).toEqual({
        errors: {
          body: ['Only 3 item(s) left in stock'],
          availableStock: 3,
        },
      });
    });

    it('answers 409 for a product out of stock, in Vietnamese on request', async () => {
      const product = await ctx.catalog.product(category, { stock: 0 });

      const response = await addToCart(buyer, product.id, 1)
        .query({ lang: 'vi' })
        .expect(409);

      expect(errorMessages(response.body)).toEqual(['Sản phẩm đã hết hàng']);
    });

    it('answers 404 for a product that is not on sale', async () => {
      const draft = await ctx.catalog.product(category, {
        status: ProductStatus.Draft,
      });

      await addToCart(buyer, draft.id, 1).expect(404);
    });

    it('rejects a quantity outside 1-99 with 400', async () => {
      const product = await ctx.catalog.product(category);

      await addToCart(buyer, product.id, 0).expect(400);
      await addToCart(buyer, product.id, 100).expect(400);
    });

    it('answers 422 once repeated adds would pass 99 of one product', async () => {
      const product = await ctx.catalog.product(category, { stock: 500 });

      await addToCart(buyer, product.id, 99).expect(201);
      const response = await addToCart(buyer, product.id, 1).expect(422);

      expect(errorMessages(response.body)).toEqual([
        'You can have at most 99 of a product in your cart',
      ]);
    });

    it('sets the quantity of an item and flags it once it runs short', async () => {
      const product = await ctx.catalog.product(category, { stock: 5 });
      const added = await addToCart(buyer, product.id, 1).expect(201);
      const [item] = cartOf(added.body).items;

      const updated = await as(buyer)
        .patch(`${CART_PATHS.items}/${item.id}`)
        .send({ item: { quantity: 4 } })
        .expect(200);

      expect(cartOf(updated.body).items[0].quantity).toBe(4);

      await ctx.dataSource
        .getRepository(Product)
        .update(product.id, { stock: 2 });
      const viewed = await as(buyer).get(CART_PATHS.cart).expect(200);

      expect(cartOf(viewed.body)).toMatchObject({
        items: [{ quantity: 4, stock: 2, available: false }],
        subtotal: 0,
      });
    });

    it("answers 404 when changing or removing someone else's item", async () => {
      const product = await ctx.catalog.product(category);
      const other = await ctx.users.createAuthenticated();
      const added = await addToCart(other, product.id, 1).expect(201);
      const [item] = cartOf(added.body).items;

      await addToCart(buyer, product.id, 1).expect(201);

      await as(buyer)
        .patch(`${CART_PATHS.items}/${item.id}`)
        .send({ item: { quantity: 2 } })
        .expect(404);
      await as(buyer).delete(`${CART_PATHS.items}/${item.id}`).expect(404);

      const response = await as(other).get(CART_PATHS.cart).expect(200);

      expect(cartOf(response.body).items[0].quantity).toBe(1);
    });

    it('removes one item, then empties the cart', async () => {
      const first = await ctx.catalog.product(category);
      const second = await ctx.catalog.product(category);
      await addToCart(buyer, first.id, 1).expect(201);
      const added = await addToCart(buyer, second.id, 1).expect(201);
      const [firstItem] = cartOf(added.body).items;

      await as(buyer).delete(`${CART_PATHS.items}/${firstItem.id}`).expect(204);
      expect(
        cartOf((await as(buyer).get(CART_PATHS.cart)).body).itemsCount,
      ).toBe(1);

      await as(buyer).delete(CART_PATHS.items).expect(204);
      expect(
        cartOf((await as(buyer).get(CART_PATHS.cart)).body).itemsCount,
      ).toBe(0);
    });
  });

  describe('checkout', () => {
    it('answers 422 for an empty cart', async () => {
      const response = await placeOrder(buyer).expect(422);

      expect(errorMessages(response.body)).toEqual(['Your cart is empty']);
    });

    it('places a pending order, takes the stock and empties the cart', async () => {
      const product = await ctx.catalog.product(category, {
        price: 150000,
        stock: 10,
      });

      const order = await orderedWith(product, 2);

      expect(order).toMatchObject({
        status: OrderStatus.Pending,
        paymentMethod: PaymentMethod.Cod,
        paymentStatus: PaymentStatus.Unpaid,
        paidAt: null,
        receiverPhone: '0901 234 567',
        subtotal: 300000,
        shippingFee: SHIPPING_FEE,
        total: 300000 + SHIPPING_FEE,
        items: [
          {
            productId: product.id,
            productName: product.name,
            unitPrice: 150000,
            quantity: 2,
            lineTotal: 300000,
          },
        ],
        statusHistory: [
          { fromStatus: null, toStatus: OrderStatus.Pending, reason: null },
        ],
      });
      expect(order.code).toMatch(ORDER_CODE_PATTERN);
      expect(await stockOf(product)).toBe(8);
      expect(cartOf((await as(buyer).get(CART_PATHS.cart)).body).items).toEqual(
        [],
      );
    });

    it('queues exactly one order confirmation mail', async () => {
      const product = await ctx.catalog.product(category, { price: 150000 });

      const order = await orderedWith(product, 2);
      const mails = ctx.mail.sentTo(buyer.user.email, MAIL_JOB.OrderCreated);

      expect(mails).toHaveLength(1);
      expect(mails[0].payload).toMatchObject({
        orderCode: order.code,
        items: [{ name: product.name, quantity: 2, lineTotal: 300000 }],
        total: 300000 + SHIPPING_FEE,
        shippingAddress: '1 Nguyen Trai, Ha Noi',
      });
    });

    it('rolls everything back when a product was archived in the meantime', async () => {
      const admin = await ctx.users.createAuthenticated({
        role: UserRole.Admin,
      });
      const kept = await ctx.catalog.product(category, { stock: 5 });
      const archived = await ctx.catalog.product(category, { stock: 5 });
      await addToCart(buyer, kept.id, 1).expect(201);
      await addToCart(buyer, archived.id, 1).expect(201);

      await as(admin)
        .patch(`${ADMIN_PRODUCTS_PATH}/${archived.id}`)
        .send({ product: { status: ProductStatus.Archived } })
        .expect(200);

      const response = await placeOrder(buyer).expect(409);

      expect(
        (response.body as { errors: ItemsUnavailableErrorDto }).errors,
      ).toEqual({
        body: ['Some items are no longer available'],
        items: [
          {
            productId: archived.id,
            name: archived.name,
            reason: 'UNAVAILABLE',
            availableStock: 0,
          },
        ],
      });
      expect(await stockOf(kept)).toBe(5);
      expect(await stockOf(archived)).toBe(5);
      expect(
        cartOf((await as(buyer).get(CART_PATHS.cart)).body).itemsCount,
      ).toBe(2);
      expect(ctx.mail.sent).toHaveLength(0);
    });

    it('sells the last unit to exactly one of two buyers ordering at once', async () => {
      const product = await ctx.catalog.product(category, { stock: 1 });
      const rival = await ctx.users.createAuthenticated();
      await addToCart(buyer, product.id, 1).expect(201);
      await addToCart(rival, product.id, 1).expect(201);

      const responses = await Promise.all([
        placeOrder(buyer),
        placeOrder(rival),
      ]);

      expect(responses.map(({ status }) => status).sort()).toEqual([201, 409]);
      expect(await stockOf(product)).toBe(0);
    });

    it('gives two orders placed at once two different codes', async () => {
      const product = await ctx.catalog.product(category, { stock: 10 });
      const rival = await ctx.users.createAuthenticated();
      await addToCart(buyer, product.id, 1).expect(201);
      await addToCart(rival, product.id, 1).expect(201);

      const responses = await Promise.all([
        placeOrder(buyer).expect(201),
        placeOrder(rival).expect(201),
      ]);
      const codes = responses.map(({ body }) => orderOf(body).code);

      expect(new Set(codes).size).toBe(2);
      expect(await stockOf(product)).toBe(8);
    });

    it('rejects an invalid receiver phone with 400', async () => {
      const product = await ctx.catalog.product(category);
      await addToCart(buyer, product.id, 1).expect(201);

      await as(buyer)
        .post(ORDERS_PATH)
        .send({
          order: {
            receiverName: 'Son',
            receiverPhone: 'call me',
            shippingAddress: 'Ha Noi',
            paymentMethod: PaymentMethod.Cod,
          },
        })
        .expect(400);
    });
  });

  describe('history and detail', () => {
    it('keeps the price paid after the product price changes', async () => {
      const product = await ctx.catalog.product(category, { price: 150000 });
      const order = await orderedWith(product, 1);

      await ctx.dataSource
        .getRepository(Product)
        .update(product.id, { price: 999000, name: 'Renamed' });
      const response = await as(buyer)
        .get(`${ORDERS_PATH}/${order.code}`)
        .expect(200);

      expect(orderOf(response.body).items[0]).toMatchObject({
        productName: product.name,
        unitPrice: 150000,
      });
    });

    it("answers 404 for someone else's order", async () => {
      const product = await ctx.catalog.product(category);
      const order = await orderedWith(product, 1);
      const other = await ctx.users.createAuthenticated();

      await as(other).get(`${ORDERS_PATH}/${order.code}`).expect(404);
    });

    it('lists only my orders, newest first, with a status filter', async () => {
      const product = await ctx.catalog.product(category);
      const first = await orderedWith(product, 1);
      const second = await orderedWith(product, 2);
      await as(buyer).post(`${ORDERS_PATH}/${first.code}/cancel`).expect(200);

      const other = await ctx.users.createAuthenticated();
      await addToCart(other, product.id, 1).expect(201);
      await placeOrder(other).expect(201);

      const all = (await as(buyer).get(ORDERS_PATH).expect(200))
        .body as OrdersResponseDto;

      expect(all.ordersCount).toBe(2);
      expect(all.orders.map(({ code }) => code)).toEqual([
        second.code,
        first.code,
      ]);
      expect(all.orders[0]).toMatchObject({
        itemsCount: 1,
        firstItemName: product.name,
        total: second.total,
      });

      const cancelled = (
        await as(buyer)
          .get(ORDERS_PATH)
          .query({ status: OrderStatus.Cancelled })
          .expect(200)
      ).body as OrdersResponseDto;

      expect(cancelled.orders.map(({ code }) => code)).toEqual([first.code]);
    });

    it('filters on the creation time and rejects a malformed date', async () => {
      const product = await ctx.catalog.product(category);
      await orderedWith(product, 1);

      const future = (
        await as(buyer)
          .get(ORDERS_PATH)
          .query({ from: '2999-01-01T00:00:00Z' })
          .expect(200)
      ).body as OrdersResponseDto;

      expect(future.ordersCount).toBe(0);
      await as(buyer).get(ORDERS_PATH).query({ to: 'yesterday' }).expect(400);
    });
  });

  describe('cancellation', () => {
    it('cancels a pending order and puts the stock back', async () => {
      const product = await ctx.catalog.product(category, { stock: 10 });
      const order = await orderedWith(product, 3);

      const response = await as(buyer)
        .post(`${ORDERS_PATH}/${order.code}/cancel`)
        .send({ order: { reason: 'Ordered the wrong size' } })
        .expect(200);

      expect(orderOf(response.body)).toMatchObject({
        status: OrderStatus.Cancelled,
        reason: 'Ordered the wrong size',
        statusHistory: [
          { fromStatus: null, toStatus: OrderStatus.Pending },
          {
            fromStatus: OrderStatus.Pending,
            toStatus: OrderStatus.Cancelled,
            reason: 'Ordered the wrong size',
          },
        ],
      });
      expect(await stockOf(product)).toBe(10);
    });

    it('answers 422 for an order that is already cancelled', async () => {
      const product = await ctx.catalog.product(category, { stock: 10 });
      const order = await orderedWith(product, 1);
      await as(buyer).post(`${ORDERS_PATH}/${order.code}/cancel`).expect(200);

      const response = await as(buyer)
        .post(`${ORDERS_PATH}/${order.code}/cancel`)
        .expect(422);

      expect(errorMessages(response.body)).toEqual([
        'Only orders awaiting confirmation can be cancelled',
      ]);
      expect(await stockOf(product)).toBe(10);
    });
  });

  describe('mock payment', () => {
    const pay = (code: string) =>
      as(buyer)
        .post(`${ORDERS_PATH}/${code}/payment`)
        .send({ payment: { transactionRef: 'FT26278123456' } });

    it('answers 422 for a cash on delivery order', async () => {
      const product = await ctx.catalog.product(category);
      const order = await orderedWith(product, 1, PaymentMethod.Cod);

      await pay(order.code).expect(422);
    });

    it('marks a bank transfer order paid once, then answers 409', async () => {
      const product = await ctx.catalog.product(category);
      const order = await orderedWith(product, 1, PaymentMethod.BankTransfer);

      const paid = await pay(order.code).expect(200);

      expect(orderOf(paid.body)).toMatchObject({
        status: OrderStatus.Pending,
        paymentStatus: PaymentStatus.Paid,
        paymentTransactionRef: 'FT26278123456',
      });
      expect(orderOf(paid.body).paidAt).not.toBeNull();

      await pay(order.code).expect(409);
    });
  });
});
