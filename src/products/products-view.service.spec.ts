import { NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { In, Repository } from 'typeorm';

import { CacheService } from '../cache/cache.service';
import { CACHE_RESOURCES } from '../common/constants/cache-keys';
import { Category } from '../categories/entities/category.entity';
import { AdminProductsQueryDto } from './dto/admin-products-query.dto';
import {
  FeaturedProductsQueryDto,
  ProductsQueryDto,
} from './dto/products-query.dto';
import { ProductImage } from './entities/product-image.entity';
import { Product } from './entities/product.entity';
import { ProductStatus } from './enums/product-status.enum';
import {
  FEATURED_PRODUCTS_CACHE_TTL_SECONDS,
  FEATURED_PRODUCTS_DEFAULT_LIMIT,
} from './products.constants';
import { ProductsViewService } from './products-view.service';

describe('ProductsViewService', () => {
  const PAGE_SIZE = 20;
  const CREATED_AT = new Date('2026-10-01T08:30:00.000Z');

  const categories = [
    { id: 'c1', name: 'Áo nam', slug: 'ao-nam', parent: null },
    { id: 'c2', name: 'Quần nam', slug: 'quan-nam', parent: null },
  ] as unknown as Category[];

  const product = (index: number): Product =>
    ({
      id: `p${index}`,
      name: `Sản phẩm ${index}`,
      slug: `san-pham-${index}`,
      description: null,
      price: 200000,
      salePrice: null,
      stock: 5,
      status: ProductStatus.Published,
      isFeatured: false,
      soldCount: 0,
      averageRating: 0,
      reviewCount: 0,
      categoryId: categories[index % 2].id,
      createdAt: CREATED_AT,
      updatedAt: CREATED_AT,
    }) as Product;

  const image = (productId: string, position: number, isThumbnail = false) =>
    ({
      id: `${productId}-i${position}`,
      productId,
      isThumbnail,
      position,
      attachment: { url: `/api/v1/attachments/${productId}-${position}` },
    }) as ProductImage;

  const builder = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    subQuery: jest.fn(),
    withDeleted: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(),
  };
  const productsRepository = {
    createQueryBuilder: jest.fn(() => builder),
    findOneBy: jest.fn(),
  };
  const imagesRepository = { find: jest.fn() };
  const categoriesRepository = { findBy: jest.fn(), findOneOrFail: jest.fn() };
  const cacheMock = {
    getOrSet: jest.fn(
      (
        _resource: string,
        _variant: unknown[],
        _ttl: number,
        factory: () => Promise<unknown>,
      ) => factory(),
    ),
  };
  const i18nMock = { t: jest.fn((key: string) => key) };

  let service: ProductsViewService;

  beforeEach(() => {
    service = new ProductsViewService(
      productsRepository as unknown as Repository<Product>,
      imagesRepository as unknown as Repository<ProductImage>,
      categoriesRepository as unknown as Repository<Category>,
      cacheMock as unknown as CacheService,
      i18nMock as unknown as I18nService,
    );

    categoriesRepository.findBy.mockResolvedValue(categories);
    imagesRepository.find.mockResolvedValue([]);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('list', () => {
    const page = Array.from({ length: PAGE_SIZE }, (_, index) =>
      product(index),
    );

    beforeEach(() => {
      builder.getManyAndCount.mockResolvedValue([page, 57]);
      imagesRepository.find.mockResolvedValue([image('p3', 0, true)]);
    });

    it('loads a page of 20 with exactly 3 queries', async () => {
      await service.list(new ProductsQueryDto());

      expect(builder.getManyAndCount).toHaveBeenCalledTimes(1);
      expect(imagesRepository.find).toHaveBeenCalledTimes(1);
      expect(categoriesRepository.findBy).toHaveBeenCalledTimes(1);
    });

    it('asks for thumbnails and categories of the page in batches', async () => {
      await service.list(new ProductsQueryDto());

      expect(imagesRepository.find).toHaveBeenCalledWith({
        where: {
          productId: In(page.map(({ id }) => id)),
          isThumbnail: true,
        },
        relations: { attachment: true },
      });
      expect(categoriesRepository.findBy).toHaveBeenCalledWith({
        id: In(['c1', 'c2']),
      });
    });

    it('lists published products only', async () => {
      await service.list(new ProductsQueryDto());

      expect(builder.where).toHaveBeenCalledWith(
        'product.status = :published',
        { published: ProductStatus.Published },
      );
    });

    it('maps every product with its thumbnail and category', async () => {
      const response = await service.list(
        Object.assign(new ProductsQueryDto(), { limit: 20, offset: 40 }),
      );

      expect(builder.offset).toHaveBeenCalledWith(40);
      expect(builder.limit).toHaveBeenCalledWith(20);
      expect(response.productsCount).toBe(57);
      expect(response.products[3]).toMatchObject({
        id: 'p3',
        thumbnailUrl: '/api/v1/attachments/p3-0',
        category: { id: 'c2', name: 'Quần nam', slug: 'quan-nam' },
        createdAt: CREATED_AT.toISOString(),
      });
      expect(response.products[0].thumbnailUrl).toBeNull();
    });

    it('skips the batch queries for an empty page', async () => {
      builder.getManyAndCount.mockResolvedValue([[], 0]);

      await expect(service.list(new ProductsQueryDto())).resolves.toEqual({
        products: [],
        productsCount: 0,
      });
      expect(imagesRepository.find).not.toHaveBeenCalled();
      expect(categoriesRepository.findBy).not.toHaveBeenCalled();
    });
  });

  describe('adminList', () => {
    beforeEach(() => {
      builder.getManyAndCount.mockResolvedValue([[], 0]);
    });

    it('lists every status without the public filter', async () => {
      await service.adminList(new AdminProductsQueryDto());

      expect(builder.where).not.toHaveBeenCalled();
      expect(builder.withDeleted).not.toHaveBeenCalled();
    });

    it('filters on status and can include deleted products', async () => {
      await service.adminList(
        Object.assign(new AdminProductsQueryDto(), {
          status: ProductStatus.Archived,
          includeDeleted: true,
        }),
      );

      expect(builder.withDeleted).toHaveBeenCalled();
      expect(builder.andWhere).toHaveBeenCalledWith(
        'product.status = :status',
        {
          status: ProductStatus.Archived,
        },
      );
    });
  });

  describe('featured', () => {
    it('caches featured products per page, best sellers first', async () => {
      builder.getManyAndCount.mockResolvedValue([[], 0]);

      await service.featured(new FeaturedProductsQueryDto());

      expect(cacheMock.getOrSet).toHaveBeenCalledWith(
        CACHE_RESOURCES.products,
        ['featured', FEATURED_PRODUCTS_DEFAULT_LIMIT, 0],
        FEATURED_PRODUCTS_CACHE_TTL_SECONDS,
        expect.any(Function),
      );
      expect(builder.andWhere).toHaveBeenCalledWith(
        'product.isFeatured = true',
      );
      expect(builder.orderBy).toHaveBeenCalledWith('product.soldCount', 'DESC');
    });
  });

  describe('findPublishedBySlug', () => {
    it('answers 404 unless a published product has the slug', async () => {
      productsRepository.findOneBy.mockResolvedValue(null);

      await expect(service.findPublishedBySlug('draft')).rejects.toThrow(
        new NotFoundException('products.NOT_FOUND'),
      );
      expect(productsRepository.findOneBy).toHaveBeenCalledWith({
        slug: 'draft',
        status: ProductStatus.Published,
      });
    });

    it('returns the product with its images in order and its category tree', async () => {
      productsRepository.findOneBy.mockResolvedValue(product(1));
      categoriesRepository.findOneOrFail.mockResolvedValue({
        ...categories[1],
        parent: { id: 'root', name: 'Thời trang nam', slug: 'thoi-trang-nam' },
      });
      imagesRepository.find.mockResolvedValue([
        image('p1', 0),
        image('p1', 1, true),
      ]);

      const { product: detail } =
        await service.findPublishedBySlug('san-pham-1');

      expect(imagesRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({ order: { position: 'ASC' } }),
      );
      expect(detail).toMatchObject({
        id: 'p1',
        description: null,
        thumbnailUrl: '/api/v1/attachments/p1-1',
        images: [
          { id: 'p1-i0', position: 0, isThumbnail: false },
          { id: 'p1-i1', position: 1, isThumbnail: true },
        ],
        category: {
          id: 'c2',
          parent: { id: 'root', slug: 'thoi-trang-nam' },
        },
        updatedAt: CREATED_AT.toISOString(),
      });
    });
  });
});
