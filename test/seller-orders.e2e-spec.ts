import { Category } from '../src/categories/entities/category.entity';
import { MAIL_JOB } from '../src/mail/mail.constants';
import {
  AdminOrderResponseDto,
  AdminOrdersResponseDto,
} from '../src/orders/dto/admin-order.dto';
import { OrderDto, OrderResponseDto } from '../src/orders/dto/order.dto';
import { OrderStatus } from '../src/orders/enums/order-status.enum';
import { PaymentStatus } from '../src/orders/enums/payment-status.enum';
import { Product } from '../src/products/entities/product.entity';
import { Shop } from '../src/shops/entities/shop.entity';
import { UserRole } from '../src/users/enums/user-role.enum';
import { UserStatus } from '../src/users/enums/user-status.enum';
import { errorMessages } from './support/http';
import { SeededUser } from './support/interfaces/seeded-user.interface';
import { TestContext } from './support/interfaces/test-context.interface';
import {
  actingAs,
  changeStatus,
  DELIVERY_PATH,
  placeOrders,
} from './support/shopper';
import { createTestApp } from './support/test-app';
import {
  ADMIN_ORDERS_PATH,
  ADMIN_USERS_PATH,
  CART_PATHS,
  ORDERS_PATH,
  productReviewsPath,
  SELLER_ORDERS_PATH,
} from './support/test.constants';

const STOCK = 20;
const REASON = 'Sản phẩm này tạm hết ở kho Hà Nội';

describe('Seller orders (e2e)', () => {
  let ctx: TestContext;
  let category: Category;
  let buyer: SeededUser;
  let admin: SeededUser;
  let bookSeller: SeededUser;
  let toySeller: SeededUser;
  let bookShop: Shop;
  let toyShop: Shop;
  let book: Product;
  let toy: Product;
  let platformItem: Product;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  beforeEach(async () => {
    category = await ctx.catalog.category();
    buyer = await ctx.users.createAuthenticated();
    admin = await ctx.users.createAuthenticated({ role: UserRole.Admin });
    bookSeller = await ctx.users.createAuthenticated();
    toySeller = await ctx.users.createAuthenticated();
    bookShop = await ctx.shops.shop(bookSeller.user, { name: 'Book shop' });
    toyShop = await ctx.shops.shop(toySeller.user, { name: 'Toy shop' });
    book = await ctx.catalog.product(category, {
      shopId: bookShop.id,
      price: 50_000,
      stock: STOCK,
    });
    toy = await ctx.catalog.product(category, {
      shopId: toyShop.id,
      price: 80_000,
      stock: STOCK,
    });
    platformItem = await ctx.catalog.product(category, { price: 10_000 });
  });

  afterEach(async () => {
    await ctx.reset();
  });

  const orderFor = (orders: OrderDto[], shop: Shop | null) =>
    orders.find(
      (order) => (order.shop?.id ?? null) === (shop?.id ?? null),
    ) as OrderDto;

  const placeAll = () =>
    placeOrders(ctx, buyer, [
      [book, 2],
      [toy, 1],
      [platformItem, 3],
    ]);

  const sellerChange = (
    seller: SeededUser,
    code: string,
    order: { status: string; reason?: string },
  ) =>
    actingAs(ctx, seller)
      .patch(`${SELLER_ORDERS_PATH}/${code}/status`)
      .send({ order });

  const stockOf = async (product: Product) =>
    (
      await ctx.dataSource
        .getRepository(Product)
        .findOneByOrFail({ id: product.id })
    ).stock;

  describe('POST /orders with items of several shops', () => {
    it('places one order per shop, each with its own shipping fee', async () => {
      const orders = await placeAll();

      expect(orders).toHaveLength(3);
      expect(orderFor(orders, bookShop)).toMatchObject({
        shop: { id: bookShop.id, name: 'Book shop', slug: bookShop.slug },
        subtotal: 100_000,
        total: 100_000 + orderFor(orders, bookShop).shippingFee,
        items: [{ productId: book.id, quantity: 2 }],
      });
      expect(orderFor(orders, toyShop).items).toMatchObject([
        { productId: toy.id },
      ]);
      expect(orderFor(orders, null)).toMatchObject({
        shop: null,
        items: [{ productId: platformItem.id, quantity: 3 }],
      });
      expect(new Set(orders.map(({ code }) => code)).size).toBe(3);
    });

    it('mails one confirmation per order and empties the cart', async () => {
      await placeAll();

      const cart = await actingAs(ctx, buyer).get(CART_PATHS.cart).expect(200);

      expect(
        ctx.mail.sentTo(buyer.user.email, MAIL_JOB.OrderCreated),
      ).toHaveLength(3);
      expect(cart.body).toMatchObject({ cart: { itemsCount: 0 } });
    });

    it('shows the buyer which shop each order comes from', async () => {
      await placeAll();

      const response = await actingAs(ctx, buyer).get(ORDERS_PATH).expect(200);

      expect(
        (response.body as { orders: OrderDto[] }).orders
          .map(({ shop }) => shop?.name ?? null)
          .sort(),
      ).toEqual(['Book shop', 'Toy shop', null].sort());
    });
  });

  describe('GET /seller/orders', () => {
    it('lists only the orders of the shop, with the customer', async () => {
      const orders = await placeAll();

      const response = await actingAs(ctx, bookSeller)
        .get(SELLER_ORDERS_PATH)
        .expect(200);

      expect(response.body as AdminOrdersResponseDto).toMatchObject({
        ordersCount: 1,
        orders: [
          {
            code: orderFor(orders, bookShop).code,
            user: { id: buyer.user.id, email: buyer.user.email },
          },
        ],
      });
    });

    it('hides the order of another shop and of the platform', async () => {
      const orders = await placeAll();

      await actingAs(ctx, bookSeller)
        .get(`${SELLER_ORDERS_PATH}/${orderFor(orders, toyShop).code}`)
        .expect(404);
      await actingAs(ctx, bookSeller)
        .get(`${SELLER_ORDERS_PATH}/${orderFor(orders, null).code}`)
        .expect(404);
    });

    it('is closed to the buyer and to an admin', async () => {
      await actingAs(ctx, buyer).get(SELLER_ORDERS_PATH).expect(403);
      await actingAs(ctx, admin).get(SELLER_ORDERS_PATH).expect(403);
    });
  });

  describe('PATCH /seller/orders/:code/status', () => {
    it('lets the shop confirm its order and emails the customer', async () => {
      const code = orderFor(await placeAll(), bookShop).code;

      const response = await sellerChange(bookSeller, code, {
        status: OrderStatus.Confirmed,
      }).expect(200);
      const { order } = response.body as AdminOrderResponseDto;

      expect(order.status).toBe(OrderStatus.Confirmed);
      expect(order.statusHistory.at(-1)?.changedBy).toMatchObject({
        id: bookSeller.user.id,
      });
      expect(
        ctx.mail.sentTo(buyer.user.email, MAIL_JOB.OrderStatusChanged)[0]
          .payload,
      ).toMatchObject({ orderCode: code, status: OrderStatus.Confirmed });
    });

    it('lets the shop deliver its order, which settles a COD payment', async () => {
      const code = orderFor(await placeAll(), bookShop).code;

      for (const status of DELIVERY_PATH) {
        await sellerChange(bookSeller, code, { status }).expect(200);
      }

      const mine = await actingAs(ctx, buyer)
        .get(`${ORDERS_PATH}/${code}`)
        .expect(200);

      expect((mine.body as OrderResponseDto).order).toMatchObject({
        status: OrderStatus.Delivered,
        paymentStatus: PaymentStatus.Paid,
      });
      await actingAs(ctx, buyer)
        .post(productReviewsPath(book.slug))
        .send({ review: { rating: 5, content: 'Sách đẹp, giao nhanh.' } })
        .expect(201);
    });

    it('needs a reason to reject, and puts the stock back', async () => {
      const code = orderFor(await placeAll(), bookShop).code;

      await sellerChange(bookSeller, code, {
        status: OrderStatus.Rejected,
      }).expect(422);
      expect(await stockOf(book)).toBe(STOCK - 2);

      await sellerChange(bookSeller, code, {
        status: OrderStatus.Rejected,
        reason: REASON,
      }).expect(200);

      expect(await stockOf(book)).toBe(STOCK);
    });

    it('refuses an order of another shop or of the platform', async () => {
      const orders = await placeAll();

      await sellerChange(bookSeller, orderFor(orders, toyShop).code, {
        status: OrderStatus.Confirmed,
      }).expect(404);
      await sellerChange(bookSeller, orderFor(orders, null).code, {
        status: OrderStatus.Confirmed,
      }).expect(404);
    });

    it('follows the same lifecycle as the admin', async () => {
      const code = orderFor(await placeAll(), bookShop).code;

      await sellerChange(bookSeller, code, {
        status: OrderStatus.Delivered,
      }).expect(422);
    });
  });

  describe('PATCH /admin/orders/:code/status', () => {
    it('leaves an order of a shop to the shop', async () => {
      const code = orderFor(await placeAll(), bookShop).code;

      const response = await actingAs(ctx, admin)
        .patch(`${ADMIN_ORDERS_PATH}/${code}/status?lang=vi`)
        .send({ order: { status: OrderStatus.Confirmed } })
        .expect(422);

      expect(errorMessages(response.body)).toEqual([
        'Đơn hàng thuộc về một shop, chỉ shop đó mới được đổi trạng thái',
      ]);
    });

    it('takes over the orders of a shop whose owner was locked', async () => {
      const code = orderFor(await placeAll(), bookShop).code;

      await actingAs(ctx, admin)
        .patch(`${ADMIN_USERS_PATH}/${bookSeller.user.id}/status`)
        .send({ user: { status: UserStatus.Inactive } })
        .expect(200);

      await actingAs(ctx, bookSeller).get(SELLER_ORDERS_PATH).expect(403);
      await changeStatus(ctx, admin, code, {
        status: OrderStatus.Rejected,
        reason: REASON,
      }).expect(200);

      expect(await stockOf(book)).toBe(STOCK);
    });

    it('still confirms an order of the platform', async () => {
      const code = orderFor(await placeAll(), null).code;

      await changeStatus(ctx, admin, code, {
        status: OrderStatus.Confirmed,
      }).expect(200);
    });

    it('still sees every order, with its shop', async () => {
      await placeAll();

      const response = await actingAs(ctx, admin)
        .get(ADMIN_ORDERS_PATH)
        .expect(200);

      expect((response.body as AdminOrdersResponseDto).ordersCount).toBe(3);
    });
  });
});
