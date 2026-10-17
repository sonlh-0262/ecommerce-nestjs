import request from 'supertest';

import { CartItemDto, CartResponseDto } from '../src/cart/dto/cart.dto';
import { CategoryResponseDto } from '../src/categories/dto/category.dto';
import { DEFAULT_SHIPPING_FEE as SHIPPING_FEE } from '../src/config/config.constants';
import { MAIL_JOB } from '../src/mail/mail.constants';
import {
  OrderDto,
  OrderResponseDto,
  OrdersResponseDto,
} from '../src/orders/dto/order.dto';
import { OrderStatus } from '../src/orders/enums/order-status.enum';
import { PaymentMethod } from '../src/orders/enums/payment-method.enum';
import {
  ProductDto,
  ProductResponseDto,
} from '../src/products/dto/product.dto';
import { ProductStatus } from '../src/products/enums/product-status.enum';
import { UserRole } from '../src/users/enums/user-role.enum';
import { PNG_IMAGE } from './support/images';
import { SeededUser } from './support/interfaces/seeded-user.interface';
import { TestContext } from './support/interfaces/test-context.interface';
import { actingAs, changeStatus, DELIVERY_PATH } from './support/shopper';
import { createTestApp } from './support/test-app';
import {
  ADMIN_CATEGORIES_PATH,
  ADMIN_PRODUCTS_PATH,
  CART_PATHS,
  ORDERS_PATH,
  PRODUCTS_PATH,
  productReviewsPath,
  TEST_RECEIVER,
} from './support/test.constants';

const STOCK = 5;
const REJECT_REASON = 'Địa chỉ giao hàng nằm ngoài khu vực phục vụ';
const RECEIVER = { ...TEST_RECEIVER, paymentMethod: PaymentMethod.Cod };

describe('Purchase journey (e2e)', () => {
  let ctx: TestContext;
  let admin: SeededUser;
  let buyer: SeededUser;
  let shirt: ProductDto;
  let shoes: ProductDto;
  let order: OrderDto;

  beforeAll(async () => {
    ctx = await createTestApp();
    admin = await ctx.users.createAuthenticated({ role: UserRole.Admin });
    buyer = await ctx.users.createAuthenticated();
  });

  afterAll(async () => {
    await ctx.reset();
    await ctx.close();
  });

  const asAdmin = () => actingAs(ctx, admin);
  const asBuyer = () => actingAs(ctx, buyer);

  const stockOf = async (slug: string) =>
    (
      (await request(ctx.server()).get(`${PRODUCTS_PATH}/${slug}`).expect(200))
        .body as ProductResponseDto
    ).product.stock;

  const cart = async () =>
    ((await asBuyer().get(CART_PATHS.cart).expect(200)).body as CartResponseDto)
      .cart;

  const checkout = async () =>
    (
      (await asBuyer().post(ORDERS_PATH).send({ order: RECEIVER }).expect(201))
        .body as OrderResponseDto
    ).order;

  const publishProduct = async (
    categoryId: string,
    name: string,
    price: number,
  ): Promise<ProductDto> => {
    const created = (
      (
        await asAdmin()
          .post(ADMIN_PRODUCTS_PATH)
          .send({ product: { name, price, stock: STOCK, categoryId } })
          .expect(201)
      ).body as ProductResponseDto
    ).product;

    await asAdmin()
      .post(`${ADMIN_PRODUCTS_PATH}/${created.id}/images`)
      .attach('files', PNG_IMAGE, 'photo.png')
      .expect(201);

    return (
      (
        await asAdmin()
          .patch(`${ADMIN_PRODUCTS_PATH}/${created.id}`)
          .send({ product: { status: ProductStatus.Published } })
          .expect(200)
      ).body as ProductResponseDto
    ).product;
  };

  describe('admin builds the catalogue', () => {
    it('creates a category and publishes two products with stock 5', async () => {
      const { category } = (
        await asAdmin()
          .post(ADMIN_CATEGORIES_PATH)
          .send({ category: { name: 'Hành trình mua hàng' } })
          .expect(201)
      ).body as CategoryResponseDto;

      shirt = await publishProduct(category.id, 'Áo hành trình', 150_000);
      shoes = await publishProduct(category.id, 'Giày hành trình', 400_000);

      expect(shirt.status).toBe(ProductStatus.Published);
      expect(await stockOf(shoes.slug)).toBe(STOCK);
    });
  });

  describe('buyer orders', () => {
    it('fills the cart, then changes a quantity', async () => {
      await asBuyer()
        .post(CART_PATHS.items)
        .send({ item: { productId: shirt.id, quantity: 1 } })
        .expect(201);
      await asBuyer()
        .post(CART_PATHS.items)
        .send({ item: { productId: shoes.id, quantity: 1 } })
        .expect(201);

      const { items } = await cart();
      const shirtLine = items.find(
        ({ productId }) => productId === shirt.id,
      ) as CartItemDto;

      await asBuyer()
        .patch(`${CART_PATHS.items}/${shirtLine.id}`)
        .send({ item: { quantity: 2 } })
        .expect(200);

      expect((await cart()).subtotal).toBe(2 * 150_000 + 400_000);
    });

    it('checks out: stock is taken, the cart empties and a mail is queued', async () => {
      order = await checkout();

      expect(order).toMatchObject({
        status: OrderStatus.Pending,
        subtotal: 700_000,
        shippingFee: SHIPPING_FEE,
        total: 700_000 + SHIPPING_FEE,
      });
      expect(await stockOf(shirt.slug)).toBe(STOCK - 2);
      expect(await stockOf(shoes.slug)).toBe(STOCK - 1);
      expect((await cart()).items).toEqual([]);
      expect(
        ctx.mail.sentTo(buyer.user.email, MAIL_JOB.OrderCreated),
      ).toHaveLength(1);
    });

    it('finds the order in the history and in detail', async () => {
      const list = (await asBuyer().get(ORDERS_PATH).expect(200))
        .body as OrdersResponseDto;
      const detail = (
        await asBuyer().get(`${ORDERS_PATH}/${order.code}`).expect(200)
      ).body as OrderResponseDto;

      expect(list.ordersCount).toBe(1);
      expect(list.orders[0]).toMatchObject({ code: order.code, itemsCount: 2 });
      expect(detail.order.items).toHaveLength(2);
    });

    it('cannot review before the order is delivered', async () => {
      await asBuyer()
        .post(productReviewsPath(shirt.slug))
        .send({ review: { rating: 5, content: 'Chưa nhận hàng mà.' } })
        .expect(403);
    });
  });

  describe('admin delivers', () => {
    it('moves the order PENDING → CONFIRMED → SHIPPING → DELIVERED', async () => {
      for (const status of DELIVERY_PATH) {
        await changeStatus(ctx, admin, order.code, { status }).expect(200);
      }

      const { order: delivered } = (
        await asBuyer().get(`${ORDERS_PATH}/${order.code}`).expect(200)
      ).body as OrderResponseDto;

      expect(delivered.status).toBe(OrderStatus.Delivered);
      expect(delivered.deliveredAt).not.toBeNull();
      expect(
        ctx.mail.sentTo(buyer.user.email, MAIL_JOB.OrderStatusChanged),
      ).toHaveLength(1);
    });
  });

  describe('buyer reviews', () => {
    it('rates both products and sees the new rating on the product page', async () => {
      await asBuyer()
        .post(productReviewsPath(shirt.slug))
        .send({ review: { rating: 4, content: 'Áo đẹp, vải mát.' } })
        .expect(201);
      await asBuyer()
        .post(productReviewsPath(shoes.slug))
        .send({ review: { rating: 2, content: 'Giày hơi chật.' } })
        .expect(201);

      const { product } = (
        await request(ctx.server())
          .get(`${PRODUCTS_PATH}/${shirt.slug}`)
          .expect(200)
      ).body as ProductResponseDto;

      expect(product).toMatchObject({ averageRating: 4, reviewCount: 1 });
    });

    it('cannot review the same product twice', async () => {
      await asBuyer()
        .post(productReviewsPath(shirt.slug))
        .send({ review: { rating: 1, content: 'Đánh giá lần hai.' } })
        .expect(409);
    });
  });

  describe('a second order the admin rejects', () => {
    it('restores the stock and mails the reason', async () => {
      await asBuyer()
        .post(CART_PATHS.items)
        .send({ item: { productId: shoes.id, quantity: 2 } })
        .expect(201);
      const rejected = await checkout();

      expect(await stockOf(shoes.slug)).toBe(STOCK - 3);

      await changeStatus(ctx, admin, rejected.code, {
        status: OrderStatus.Rejected,
        reason: REJECT_REASON,
      }).expect(200);

      expect(await stockOf(shoes.slug)).toBe(STOCK - 1);
      expect(
        ctx.mail.sentTo(buyer.user.email, MAIL_JOB.OrderStatusChanged).at(-1)
          ?.payload,
      ).toMatchObject({
        orderCode: rejected.code,
        status: OrderStatus.Rejected,
        reason: REJECT_REASON,
      });
    });
  });
});
