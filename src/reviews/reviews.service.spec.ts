import {
  ConflictException,
  ForbiddenException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { EntityManager, QueryFailedError } from 'typeorm';

import { PG_UNIQUE_VIOLATION } from '../database/database.constants';
import { transactionalDataSource } from '../database/transaction.fixture';
import { OrderStatus } from '../orders/enums/order-status.enum';
import { Product } from '../products/entities/product.entity';
import { ProductsService } from '../products/products.service';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/enums/user-role.enum';
import { Review } from './entities/review.entity';
import { UNIQUE_REVIEWS_PRODUCT_USER_INDEX } from './reviews.constants';
import { ReviewsService } from './reviews.service';
import { ReviewsViewService } from './reviews-view.service';

describe('ReviewsService', () => {
  const SLUG = 'ao-thun';
  const REVIEW_ID = 'r1';
  const USER = { id: 'u1', role: UserRole.User } as User;
  const ADMIN = { id: 'a1', role: UserRole.Admin } as User;
  const PRODUCT = { id: 'p1', slug: SLUG } as Product;
  const INPUT = { rating: 5, content: 'Vải mát, mặc vừa người.' };

  const stored = (overrides: Partial<Review> = {}): Review =>
    ({
      id: REVIEW_ID,
      productId: PRODUCT.id,
      userId: USER.id,
      rating: 4,
      content: 'Giao hàng nhanh, đóng gói kỹ.',
      ...overrides,
    }) as Review;

  const queryBuilder = {
    select: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    getRawOne: jest.fn(),
  };
  const managerMock = {
    createQueryBuilder: jest.fn(() => queryBuilder),
    create: jest.fn((_entity: unknown, value: Partial<Review>) => value),
    save: jest.fn((value: Partial<Review>) =>
      Promise.resolve({ id: REVIEW_ID, ...value } as Review),
    ),
    findOne: jest.fn(),
    findOneByOrFail: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  const manager = managerMock as unknown as EntityManager;
  const { dataSource } = transactionalDataSource(manager);
  const productsMock = { refreshRating: jest.fn() };
  const viewMock = {
    findProduct: jest.fn(),
    viewOf: jest.fn((review: Review) => Promise.resolve({ review })),
  };
  const i18nMock = { t: jest.fn((key: string) => key) };

  const service = new ReviewsService(
    dataSource,
    productsMock as unknown as ProductsService,
    viewMock as unknown as ReviewsViewService,
    i18nMock as unknown as I18nService,
  );

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    viewMock.findProduct.mockResolvedValue(PRODUCT);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('answers 404 for an unknown product before anything else', async () => {
      viewMock.findProduct.mockRejectedValue(
        new NotFoundException('products.NOT_FOUND'),
      );

      await expect(service.create(USER, SLUG, INPUT)).rejects.toThrow(
        NotFoundException,
      );
      expect(managerMock.save).not.toHaveBeenCalled();
    });

    it('looks for my latest delivered order containing the product', async () => {
      queryBuilder.getRawOne.mockResolvedValue({ id: 'o1' });

      await service.create(USER, SLUG, INPUT);

      expect(queryBuilder.where).toHaveBeenCalledWith(
        'order.userId = :userId',
        { userId: USER.id },
      );
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'item.productId = :productId',
        { productId: PRODUCT.id },
      );
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'order.status = :delivered',
        { delivered: OrderStatus.Delivered },
      );
      expect(queryBuilder.orderBy).toHaveBeenCalledWith(
        'order.deliveredAt',
        'DESC',
      );
    });

    it('answers 403 when no delivered order contains the product', async () => {
      queryBuilder.getRawOne.mockResolvedValue(undefined);

      await expect(service.create(USER, SLUG, INPUT)).rejects.toThrow(
        new ForbiddenException('reviews.NOT_PURCHASED'),
      );
      expect(managerMock.save).not.toHaveBeenCalled();
      expect(productsMock.refreshRating).not.toHaveBeenCalled();
    });

    it('ties the review to the order and recounts the product', async () => {
      queryBuilder.getRawOne.mockResolvedValue({ id: 'o1' });

      await expect(service.create(USER, SLUG, INPUT)).resolves.toEqual({
        review: {
          id: REVIEW_ID,
          ...INPUT,
          productId: PRODUCT.id,
          userId: USER.id,
          orderId: 'o1',
        },
      });
      expect(productsMock.refreshRating).toHaveBeenCalledWith(
        manager,
        PRODUCT.id,
      );
      expect(viewMock.viewOf).toHaveBeenCalledWith(
        expect.objectContaining({ id: REVIEW_ID }),
        USER,
      );
    });

    it('answers 409 for a second review of the same product', async () => {
      queryBuilder.getRawOne.mockResolvedValue({ id: 'o1' });
      managerMock.save.mockRejectedValueOnce(
        new QueryFailedError('INSERT', [], {
          code: PG_UNIQUE_VIOLATION,
          constraint: UNIQUE_REVIEWS_PRODUCT_USER_INDEX,
        } as unknown as Error),
      );

      await expect(service.create(USER, SLUG, INPUT)).rejects.toThrow(
        new ConflictException('reviews.ALREADY_REVIEWED'),
      );
    });

    it('rethrows any other failure untouched', async () => {
      const failure = new Error('connection lost');
      queryBuilder.getRawOne.mockResolvedValue({ id: 'o1' });
      managerMock.save.mockRejectedValueOnce(failure);

      await expect(service.create(USER, SLUG, INPUT)).rejects.toBe(failure);
    });
  });

  describe('update', () => {
    beforeEach(() => {
      managerMock.findOneByOrFail.mockResolvedValue(stored());
    });

    it("answers 404 for someone else's review", async () => {
      managerMock.findOne.mockResolvedValue(null);

      await expect(
        service.update(USER, REVIEW_ID, { rating: 1 }),
      ).rejects.toThrow(new NotFoundException('reviews.NOT_FOUND'));
      expect(managerMock.findOne).toHaveBeenCalledWith(Review, {
        where: { id: REVIEW_ID, userId: USER.id },
        lock: { mode: 'pessimistic_write' },
      });
      expect(managerMock.update).not.toHaveBeenCalled();
    });

    it('recounts the product when the stars change', async () => {
      managerMock.findOne.mockResolvedValue(stored({ rating: 5 }));

      await service.update(USER, REVIEW_ID, { rating: 1 });

      expect(managerMock.update).toHaveBeenCalledWith(
        Review,
        { id: REVIEW_ID },
        { rating: 1 },
      );
      expect(productsMock.refreshRating).toHaveBeenCalledWith(
        manager,
        PRODUCT.id,
      );
    });

    it.each([
      ['only the text changes', { content: 'Mặc lâu vẫn bền màu.' }],
      ['the stars stay the same', { rating: 4 }],
    ])('leaves the product alone when %s', async (_label, input) => {
      managerMock.findOne.mockResolvedValue(stored({ rating: 4 }));

      await service.update(USER, REVIEW_ID, input);

      expect(productsMock.refreshRating).not.toHaveBeenCalled();
    });

    it('answers with the review as stored after the change', async () => {
      managerMock.findOne.mockResolvedValue(stored());

      await expect(
        service.update(USER, REVIEW_ID, { content: 'Mặc lâu vẫn bền màu.' }),
      ).resolves.toEqual({ review: stored() });
      expect(viewMock.viewOf).toHaveBeenCalledWith(stored(), USER);
    });
  });

  describe('remove', () => {
    it("answers 404 for someone else's review when I am not an admin", async () => {
      managerMock.findOne.mockResolvedValue(null);

      await expect(service.remove(USER, REVIEW_ID)).rejects.toThrow(
        new NotFoundException('reviews.NOT_FOUND'),
      );
      expect(managerMock.findOne).toHaveBeenCalledWith(Review, {
        where: { id: REVIEW_ID, userId: USER.id },
        lock: { mode: 'pessimistic_write' },
      });
      expect(managerMock.delete).not.toHaveBeenCalled();
    });

    it("lets an admin delete anyone's review", async () => {
      managerMock.findOne.mockResolvedValue(stored());

      await service.remove(ADMIN, REVIEW_ID);

      expect(managerMock.findOne).toHaveBeenCalledWith(Review, {
        where: { id: REVIEW_ID },
        lock: { mode: 'pessimistic_write' },
      });
      expect(managerMock.delete).toHaveBeenCalledWith(Review, {
        id: REVIEW_ID,
      });
    });

    it('recounts the product after deleting', async () => {
      managerMock.findOne.mockResolvedValue(stored());

      await service.remove(USER, REVIEW_ID);

      expect(productsMock.refreshRating).toHaveBeenCalledWith(
        manager,
        PRODUCT.id,
      );
      expect(managerMock.delete.mock.invocationCallOrder[0]).toBeLessThan(
        productsMock.refreshRating.mock.invocationCallOrder[0],
      );
    });
  });
});
