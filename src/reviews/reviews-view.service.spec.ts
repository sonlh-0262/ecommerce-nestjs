import { NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { In, Repository } from 'typeorm';

import { Product } from '../products/entities/product.entity';
import { ProductStatus } from '../products/enums/product-status.enum';
import { ProductsService } from '../products/products.service';
import { User } from '../users/entities/user.entity';
import { UserAvatarsService } from '../users/user-avatars.service';
import { ReviewsQueryDto } from './dto/reviews-query.dto';
import { Review } from './entities/review.entity';
import { ReviewsViewService } from './reviews-view.service';

describe('ReviewsViewService', () => {
  const PRODUCT = {
    id: 'p1',
    slug: 'ao-thun',
    status: ProductStatus.Published,
    averageRating: 4.5,
    reviewCount: 2,
  } as Product;

  const review = (id: string, userId: string, rating: number) =>
    ({ id, userId, rating, productId: PRODUCT.id }) as Review;

  const distributionBuilder = {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    getRawMany: jest.fn(),
  };
  const reviewsRepository = {
    findAndCount: jest.fn(),
    createQueryBuilder: jest.fn(() => distributionBuilder),
  };
  const usersRepository = { find: jest.fn() };
  const productsMock = { findBySlug: jest.fn() };
  const avatarsMock = { urlsOf: jest.fn(), urlOf: jest.fn() };
  const i18nMock = { t: jest.fn((key: string) => key) };

  const service = new ReviewsViewService(
    reviewsRepository as unknown as Repository<Review>,
    usersRepository as unknown as Repository<User>,
    productsMock as unknown as ProductsService,
    avatarsMock as unknown as UserAvatarsService,
    i18nMock as unknown as I18nService,
  );

  const query = (overrides: Partial<ReviewsQueryDto> = {}) =>
    Object.assign(new ReviewsQueryDto(), overrides);

  beforeEach(() => {
    productsMock.findBySlug.mockResolvedValue(PRODUCT);
    reviewsRepository.findAndCount.mockResolvedValue([[], 0]);
    distributionBuilder.getRawMany.mockResolvedValue([]);
    usersRepository.find.mockResolvedValue([]);
    avatarsMock.urlsOf.mockResolvedValue(new Map());
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('answers 404 for a product that does not exist', async () => {
    productsMock.findBySlug.mockResolvedValue(null);

    await expect(service.list('nope', query())).rejects.toThrow(
      new NotFoundException('products.NOT_FOUND'),
    );
  });

  it('answers 404 for a draft, which the shop does not show', async () => {
    productsMock.findBySlug.mockResolvedValue({
      ...PRODUCT,
      status: ProductStatus.Draft,
    });

    await expect(service.findProduct(PRODUCT.slug)).rejects.toThrow(
      new NotFoundException('products.NOT_FOUND'),
    );
  });

  it('finds an archived product, whose buyers may still review it', async () => {
    const archived = { ...PRODUCT, status: ProductStatus.Archived };
    productsMock.findBySlug.mockResolvedValue(archived);

    await expect(service.findProduct(PRODUCT.slug)).resolves.toBe(archived);
  });

  it('pages the reviews newest first, filtered on the stars', async () => {
    await service.list(
      PRODUCT.slug,
      query({ rating: 4, limit: 5, offset: 10 }),
    );

    expect(reviewsRepository.findAndCount).toHaveBeenCalledWith({
      where: { productId: PRODUCT.id, rating: 4 },
      order: { createdAt: 'DESC', id: 'DESC' },
      skip: 10,
      take: 5,
    });
  });

  it('spreads the counts over every star, filling the missing ones with 0', async () => {
    distributionBuilder.getRawMany.mockResolvedValue([
      { rating: 5, count: '24' },
      { rating: 3, count: '5' },
    ]);

    const page = await service.list(PRODUCT.slug, query({ rating: 1 }));

    expect(distributionBuilder.where).toHaveBeenCalledWith(
      'review.productId = :productId',
      { productId: PRODUCT.id },
    );
    expect(page.summary).toEqual({
      average: 4.5,
      total: 2,
      distribution: { 1: 0, 2: 0, 3: 5, 4: 0, 5: 24 },
    });
  });

  it('loads the authors of a page in one query, without their email', async () => {
    reviewsRepository.findAndCount.mockResolvedValue([
      [review('r1', 'u1', 5), review('r2', 'u2', 4), review('r3', 'u1', 3)],
      3,
    ]);
    usersRepository.find.mockResolvedValue([
      { id: 'u1', username: 'son', fullName: 'Son' },
      { id: 'u2', username: 'lan', fullName: null },
    ]);
    avatarsMock.urlsOf.mockResolvedValue(new Map([['u2', '/avatar-u2']]));

    const page = await service.list(PRODUCT.slug, query());

    expect(usersRepository.find).toHaveBeenCalledWith({
      where: { id: In(['u1', 'u2']) },
      select: { id: true, username: true, fullName: true },
      withDeleted: true,
    });
    expect(page.total).toBe(3);
    expect(page.reviews.map(({ author }) => author)).toEqual([
      { username: 'son', fullName: 'Son', avatarUrl: null },
      { username: 'lan', fullName: null, avatarUrl: '/avatar-u2' },
      { username: 'son', fullName: 'Son', avatarUrl: null },
    ]);
  });

  it('skips the author queries for an empty page', async () => {
    await service.list(PRODUCT.slug, query());

    expect(usersRepository.find).not.toHaveBeenCalled();
    expect(avatarsMock.urlsOf).not.toHaveBeenCalled();
  });

  it('shows a single review with its author and avatar', async () => {
    avatarsMock.urlOf.mockResolvedValue('/avatar-u1');
    const author = { id: 'u1', username: 'son', fullName: 'Son' } as User;

    await expect(
      service.viewOf(review('r1', 'u1', 5), author),
    ).resolves.toEqual({
      review: review('r1', 'u1', 5),
      author: { username: 'son', fullName: 'Son', avatarUrl: '/avatar-u1' },
    });
  });
});
