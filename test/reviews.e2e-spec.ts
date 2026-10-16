import { randomUUID } from 'crypto';
import request from 'supertest';

import { Category } from '../src/categories/entities/category.entity';
import { OrderStatus } from '../src/orders/enums/order-status.enum';
import { ProductResponseDto } from '../src/products/dto/product.dto';
import { Product } from '../src/products/entities/product.entity';
import { ProductStatus } from '../src/products/enums/product-status.enum';
import {
  ReviewResponseDto,
  ReviewsResponseDto,
} from '../src/reviews/dto/review.dto';
import { UserRole } from '../src/users/enums/user-role.enum';
import { errorMessages } from './support/http';
import { SeededUser } from './support/interfaces/seeded-user.interface';
import { TestContext } from './support/interfaces/test-context.interface';
import { actingAs, changeStatus, deliver, placeOrder } from './support/shopper';
import { createTestApp } from './support/test-app';
import {
  PRODUCTS_PATH,
  productReviewsPath,
  REVIEWS_PATH,
} from './support/test.constants';

interface RatingCheckRow {
  stored_count: number;
  stored_average: string;
  actual_count: number;
  actual_average: string;
}

describe('Reviews (e2e)', () => {
  const CONTENT = 'Vải mát, mặc vừa người, giao hàng nhanh.';

  let ctx: TestContext;
  let category: Category;
  let product: Product;
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
    product = await ctx.catalog.product(category);
    admin = await ctx.users.createAuthenticated({ role: UserRole.Admin });
    buyer = await ctx.users.createAuthenticated({ fullName: 'Lanh Hung Son' });
  });

  afterEach(async () => {
    await expectRatingsReconciled();
    await ctx.reset();
  });

  const reviewOf = (body: unknown) => (body as ReviewResponseDto).review;

  const postReview = (
    user: SeededUser,
    review: { rating: number; content: string },
    slug = product.slug,
  ) => actingAs(ctx, user).post(productReviewsPath(slug)).send({ review });

  const deliveredBuyer = async (user = buyer) => {
    const order = await placeOrder(ctx, user, [[product, 1]]);
    await deliver(ctx, admin, order.code);

    return user;
  };

  const reviewed = async (user: SeededUser, rating: number) => {
    await deliveredBuyer(user);

    return reviewOf(
      (await postReview(user, { rating, content: CONTENT }).expect(201)).body,
    );
  };

  const ratingOfProduct = async () => {
    const response = await request(ctx.server())
      .get(`${PRODUCTS_PATH}/${product.slug}`)
      .expect(200);
    const { averageRating, reviewCount } = (response.body as ProductResponseDto)
      .product;

    return { averageRating, reviewCount };
  };

  const expectRatingsReconciled = async () => {
    const rows = await ctx.dataSource.query<RatingCheckRow[]>(
      `SELECT p.review_count AS stored_count,
              p.average_rating AS stored_average,
              COUNT(r.id)::int AS actual_count,
              COALESCE(ROUND(AVG(r.rating), 2), 0)::numeric(3, 2) AS actual_average
         FROM products p
         LEFT JOIN reviews r ON r.product_id = p.id
        GROUP BY p.id`,
    );

    for (const row of rows) {
      expect(row.stored_count).toBe(row.actual_count);
      expect(Number(row.stored_average)).toBe(Number(row.actual_average));
    }
  };

  describe('POST /products/:slug/reviews', () => {
    it('refuses a guest with 401', async () => {
      await request(ctx.server())
        .post(productReviewsPath(product.slug))
        .send({ review: { rating: 5, content: CONTENT } })
        .expect(401);
    });

    it('answers 403 for a product I never bought', async () => {
      const response = await postReview(buyer, {
        rating: 5,
        content: CONTENT,
      }).expect(403);

      expect(errorMessages(response.body)).toEqual([
        'You can only review products from a delivered order',
      ]);
    });

    it('answers 403 while my order is only CONFIRMED, in Vietnamese on request', async () => {
      const order = await placeOrder(ctx, buyer, [[product, 1]]);
      await changeStatus(ctx, admin, order.code, {
        status: OrderStatus.Confirmed,
      }).expect(200);

      const response = await postReview(buyer, { rating: 5, content: CONTENT })
        .query({ lang: 'vi' })
        .expect(403);

      expect(errorMessages(response.body)).toEqual([
        'Bạn chỉ có thể đánh giá sản phẩm thuộc đơn hàng đã giao',
      ]);
    });

    it('creates the review once my order is DELIVERED', async () => {
      await deliveredBuyer();

      const response = await postReview(buyer, {
        rating: 5,
        content: `  ${CONTENT}  `,
      }).expect(201);

      expect(reviewOf(response.body)).toEqual({
        id: expect.any(String) as string,
        rating: 5,
        content: CONTENT,
        user: {
          username: buyer.user.username,
          fullName: 'Lanh Hung Son',
          avatarUrl: null,
        },
        createdAt: expect.any(String) as string,
        updatedAt: expect.any(String) as string,
      });
      expect(await ratingOfProduct()).toEqual({
        averageRating: 5,
        reviewCount: 1,
      });
    });

    it('answers 409 for a second review of the same product', async () => {
      await reviewed(buyer, 5);

      const response = await postReview(buyer, {
        rating: 1,
        content: CONTENT,
      }).expect(409);

      expect(errorMessages(response.body)).toEqual([
        'You have already reviewed this product',
      ]);
    });

    it('answers 404 for an unknown product', async () => {
      await postReview(buyer, { rating: 5, content: CONTENT }, 'nope').expect(
        404,
      );
    });

    it('still accepts a review of an archived product I received', async () => {
      await deliveredBuyer();
      await ctx.dataSource
        .getRepository(Product)
        .update({ id: product.id }, { status: ProductStatus.Archived });

      await postReview(buyer, { rating: 4, content: CONTENT }).expect(201);
    });

    it('answers 404 for a product put back to DRAFT, on read and write', async () => {
      await deliveredBuyer();
      await ctx.dataSource
        .getRepository(Product)
        .update({ id: product.id }, { status: ProductStatus.Draft });

      await postReview(buyer, { rating: 4, content: CONTENT }).expect(404);
      await request(ctx.server())
        .get(productReviewsPath(product.slug))
        .expect(404);
    });

    it.each([
      ['0 stars', { rating: 0, content: CONTENT }],
      ['6 stars', { rating: 6, content: CONTENT }],
      ['half a star', { rating: 4.5, content: CONTENT }],
      ['no text', { rating: 5 }],
      ['text too short', { rating: 5, content: 'Quá tốt' }],
      ['text too long', { rating: 5, content: 'x'.repeat(1001) }],
    ])('rejects %s with 400', async (_label, review) => {
      await deliveredBuyer();

      await actingAs(ctx, buyer)
        .post(productReviewsPath(product.slug))
        .send({ review })
        .expect(400);
    });
  });

  describe('rating aggregate', () => {
    it('averages 4 and 5 stars to 4.50 over 2 reviews', async () => {
      await reviewed(buyer, 4);
      await reviewed(await ctx.users.createAuthenticated(), 5);

      expect(await ratingOfProduct()).toEqual({
        averageRating: 4.5,
        reviewCount: 2,
      });
    });

    it('rounds the average to 2 decimals', async () => {
      await reviewed(buyer, 5);
      await reviewed(await ctx.users.createAuthenticated(), 4);
      await reviewed(await ctx.users.createAuthenticated(), 4);

      expect((await ratingOfProduct()).averageRating).toBe(4.33);
    });

    it('follows an edit from 5 stars down to 1', async () => {
      const review = await reviewed(buyer, 5);
      await reviewed(await ctx.users.createAuthenticated(), 4);

      const response = await actingAs(ctx, buyer)
        .patch(`${REVIEWS_PATH}/${review.id}`)
        .send({ review: { rating: 1 } })
        .expect(200);

      expect(reviewOf(response.body).rating).toBe(1);
      expect(await ratingOfProduct()).toEqual({
        averageRating: 2.5,
        reviewCount: 2,
      });
    });

    it('drops back to 0 once every review is deleted', async () => {
      const mine = await reviewed(buyer, 5);
      const other = await ctx.users.createAuthenticated();
      const theirs = await reviewed(other, 3);

      await actingAs(ctx, buyer)
        .delete(`${REVIEWS_PATH}/${mine.id}`)
        .expect(204);
      expect(await ratingOfProduct()).toEqual({
        averageRating: 3,
        reviewCount: 1,
      });

      await actingAs(ctx, admin)
        .delete(`${REVIEWS_PATH}/${theirs.id}`)
        .expect(204);
      expect(await ratingOfProduct()).toEqual({
        averageRating: 0,
        reviewCount: 0,
      });
    });

    it('keeps the count right under concurrent reviews', async () => {
      const buyers = [
        buyer,
        await ctx.users.createAuthenticated(),
        await ctx.users.createAuthenticated(),
        await ctx.users.createAuthenticated(),
      ];

      for (const user of buyers) {
        await deliveredBuyer(user);
      }

      await Promise.all(
        buyers.map((user, index) =>
          postReview(user, { rating: index + 2, content: CONTENT }).expect(201),
        ),
      );

      expect(await ratingOfProduct()).toEqual({
        averageRating: 3.5,
        reviewCount: 4,
      });
    });
  });

  describe('PATCH /reviews/:id', () => {
    it('edits the text only', async () => {
      const review = await reviewed(buyer, 5);

      const response = await actingAs(ctx, buyer)
        .patch(`${REVIEWS_PATH}/${review.id}`)
        .send({ review: { content: 'Mặc sau nhiều lần giặt vẫn bền màu.' } })
        .expect(200);

      expect(reviewOf(response.body)).toMatchObject({
        id: review.id,
        rating: 5,
        content: 'Mặc sau nhiều lần giặt vẫn bền màu.',
      });
    });

    it("answers 404 for someone else's review, even to an admin", async () => {
      const review = await reviewed(buyer, 5);
      const other = await ctx.users.createAuthenticated();

      for (const user of [other, admin]) {
        await actingAs(ctx, user)
          .patch(`${REVIEWS_PATH}/${review.id}`)
          .send({ review: { rating: 1 } })
          .expect(404);
      }
    });

    it('rejects an empty change with 400 and a bad id with 400', async () => {
      const review = await reviewed(buyer, 5);

      await actingAs(ctx, buyer)
        .patch(`${REVIEWS_PATH}/${review.id}`)
        .send({ review: {} })
        .expect(400);
      await actingAs(ctx, buyer)
        .patch(`${REVIEWS_PATH}/not-a-uuid`)
        .send({ review: { rating: 1 } })
        .expect(400);
    });
  });

  describe('DELETE /reviews/:id', () => {
    it("answers 404 for someone else's review, in Vietnamese on request", async () => {
      const review = await reviewed(buyer, 5);
      const other = await ctx.users.createAuthenticated();

      const response = await actingAs(ctx, other)
        .delete(`${REVIEWS_PATH}/${review.id}`)
        .query({ lang: 'vi' })
        .expect(404);

      expect(errorMessages(response.body)).toEqual(['Không tìm thấy đánh giá']);
    });

    it('answers 404 for a review that does not exist', async () => {
      await actingAs(ctx, admin)
        .delete(`${REVIEWS_PATH}/${randomUUID()}`)
        .expect(404);
    });
  });

  describe('GET /products/:slug/reviews', () => {
    it('lists the reviews publicly, newest first, with the distribution and no email', async () => {
      await reviewed(buyer, 5);
      const second = await ctx.users.createAuthenticated();
      await reviewed(second, 4);
      await reviewed(await ctx.users.createAuthenticated(), 5);

      const response = await request(ctx.server())
        .get(productReviewsPath(product.slug))
        .expect(200);
      const body = response.body as ReviewsResponseDto;

      expect(body.reviewsCount).toBe(3);
      expect(body.reviews[1].user).toEqual({
        username: second.user.username,
        fullName: null,
        avatarUrl: null,
      });
      expect(body.summary).toEqual({
        average: 4.67,
        total: 3,
        distribution: { 1: 0, 2: 0, 3: 0, 4: 1, 5: 2 },
      });
      expect(JSON.stringify(body)).not.toContain('@example.com');
    });

    it('filters on the stars but keeps the summary of every review', async () => {
      await reviewed(buyer, 5);
      await reviewed(await ctx.users.createAuthenticated(), 4);

      const response = await request(ctx.server())
        .get(productReviewsPath(product.slug))
        .query({ rating: 4, limit: 1 })
        .expect(200);
      const body = response.body as ReviewsResponseDto;

      expect(body.reviews.map(({ rating }) => rating)).toEqual([4]);
      expect(body.reviewsCount).toBe(1);
      expect(body.summary.total).toBe(2);
    });

    it('answers an empty page for a product nobody reviewed', async () => {
      const response = await request(ctx.server())
        .get(productReviewsPath(product.slug))
        .expect(200);

      expect(response.body).toEqual({
        reviews: [],
        reviewsCount: 0,
        summary: {
          average: 0,
          total: 0,
          distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        },
      });
    });

    it('answers 404 for an unknown product and 400 for a rating of 6', async () => {
      await request(ctx.server()).get(productReviewsPath('nope')).expect(404);
      await request(ctx.server())
        .get(productReviewsPath(product.slug))
        .query({ rating: 6 })
        .expect(400);
    });
  });
});
