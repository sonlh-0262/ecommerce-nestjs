import {
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { EntityManager, Repository } from 'typeorm';

import { CacheService } from '../cache/cache.service';
import { CartItem } from '../cart/entities/cart-item.entity';
import { CategoriesService } from '../categories/categories.service';
import { CACHE_RESOURCES } from '../common/constants/cache-keys';
import { transactionalDataSource } from '../database/transaction.fixture';
import { CreateProductBodyDto } from './dto/create-product.dto';
import { ProductImage } from './entities/product-image.entity';
import { Product } from './entities/product.entity';
import { ProductStatus } from './enums/product-status.enum';
import { ProductsService } from './products.service';

describe('ProductsService', () => {
  const PRODUCT_ID = '00000000-0000-4000-8000-000000000010';
  const CATEGORY_ID = '00000000-0000-4000-8000-000000000020';

  const stored = (overrides: Partial<Product> = {}): Product =>
    ({
      id: PRODUCT_ID,
      name: 'Áo thun',
      slug: 'ao-thun',
      price: 200000,
      salePrice: null,
      status: ProductStatus.Draft,
      categoryId: CATEGORY_ID,
      ...overrides,
    }) as Product;

  const input = (
    overrides: Partial<CreateProductBodyDto> = {},
  ): CreateProductBodyDto => ({
    name: 'Áo Thun',
    price: 200000,
    stock: 5,
    categoryId: CATEGORY_ID,
    ...overrides,
  });

  const productsRepository = {
    existsBy: jest.fn(),
    create: jest.fn((value: Partial<Product>) => value),
    save: jest.fn((value: Partial<Product>) =>
      Promise.resolve({ id: PRODUCT_ID, ...value } as Product),
    ),
  };
  const managerMock = {
    findOne: jest.fn(),
    findOneByOrFail: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    existsBy: jest.fn(),
    getRepository: jest.fn(() => productsRepository),
  };
  const { dataSource } = transactionalDataSource(
    managerMock as unknown as EntityManager,
  );
  const categoriesMock = { lockShared: jest.fn() };
  const cacheMock = { invalidate: jest.fn() };
  const i18nMock = { t: jest.fn((key: string) => key) };

  let service: ProductsService;

  const expectCatalogCacheCleared = () =>
    expect(cacheMock.invalidate).toHaveBeenCalledWith(
      CACHE_RESOURCES.products,
      CACHE_RESOURCES.categories,
    );

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);

    service = new ProductsService(
      productsRepository as unknown as Repository<Product>,
      dataSource,
      categoriesMock as unknown as CategoriesService,
      cacheMock as unknown as CacheService,
      i18nMock as unknown as I18nService,
    );

    productsRepository.existsBy.mockResolvedValue(false);
    categoriesMock.lockShared.mockResolvedValue({ id: CATEGORY_ID });
    managerMock.findOne.mockResolvedValue(stored());
    managerMock.findOneByOrFail.mockImplementation(() =>
      Promise.resolve(stored()),
    );
    managerMock.existsBy.mockResolvedValue(false);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('creates a draft with a slug from its name', async () => {
      const product = await service.create(input());

      expect(product).toMatchObject({
        slug: 'ao-thun',
        status: ProductStatus.Draft,
        salePrice: null,
        description: null,
        isFeatured: false,
      });
      expectCatalogCacheCleared();
    });

    it('holds the category for the insert so it cannot be deleted under it', async () => {
      await service.create(input());

      expect(categoriesMock.lockShared).toHaveBeenCalledWith(
        managerMock,
        CATEGORY_ID,
      );
    });

    it('never takes the slug of the featured route', async () => {
      const product = await service.create(input({ name: 'Featured' }));

      expect(product.slug).toBe('featured-2');
    });

    it('refuses an unknown category with 422', async () => {
      categoriesMock.lockShared.mockResolvedValue(null);

      await expect(service.create(input())).rejects.toThrow(
        new UnprocessableEntityException('products.CATEGORY_NOT_FOUND'),
      );
      expect(productsRepository.save).not.toHaveBeenCalled();
    });

    it.each([200000, 250000])(
      'refuses a sale price of %p for a price of 200000 with 422',
      async (salePrice) => {
        await expect(service.create(input({ salePrice }))).rejects.toThrow(
          new UnprocessableEntityException('products.SALE_PRICE_TOO_HIGH'),
        );
      },
    );

    it('refuses to start PUBLISHED, without images, with 422', async () => {
      await expect(
        service.create(input({ status: ProductStatus.Published })),
      ).rejects.toThrow(new UnprocessableEntityException('products.NO_IMAGES'));
    });
  });

  describe('update', () => {
    it('answers 404 for an unknown or deleted product', async () => {
      managerMock.findOne.mockResolvedValue(null);

      await expect(service.update(PRODUCT_ID, { stock: 1 })).rejects.toThrow(
        new NotFoundException('products.NOT_FOUND'),
      );
    });

    it('locks the row, applies the patch and returns the stored product', async () => {
      const updated = await service.update(PRODUCT_ID, { name: 'Áo mới' });

      expect(managerMock.findOne).toHaveBeenCalledWith(Product, {
        where: { id: PRODUCT_ID },
        lock: { mode: 'pessimistic_write' },
      });
      expect(managerMock.update).toHaveBeenCalledWith(
        Product,
        { id: PRODUCT_ID },
        { name: 'Áo mới' },
      );
      expect(updated.slug).toBe('ao-thun');
      expectCatalogCacheCleared();
    });

    it('checks a lowered price against the stored sale price', async () => {
      managerMock.findOne.mockResolvedValue(stored({ salePrice: 150000 }));

      await expect(
        service.update(PRODUCT_ID, { price: 150000 }),
      ).rejects.toThrow(
        new UnprocessableEntityException('products.SALE_PRICE_TOO_HIGH'),
      );
    });

    it('lets a null sale price clear the discount', async () => {
      managerMock.findOne.mockResolvedValue(stored({ salePrice: 150000 }));

      await service.update(PRODUCT_ID, { price: 100000, salePrice: null });

      expect(managerMock.update).toHaveBeenCalled();
    });

    it('refuses a category that does not exist with 422', async () => {
      categoriesMock.lockShared.mockResolvedValue(null);

      await expect(
        service.update(PRODUCT_ID, {
          categoryId: '00000000-0000-4000-8000-000000000099',
        }),
      ).rejects.toThrow(
        new UnprocessableEntityException('products.CATEGORY_NOT_FOUND'),
      );
    });

    it('refuses to publish a product without images with 422', async () => {
      await expect(
        service.update(PRODUCT_ID, { status: ProductStatus.Published }),
      ).rejects.toThrow(new UnprocessableEntityException('products.NO_IMAGES'));
      expect(managerMock.existsBy).toHaveBeenCalledWith(ProductImage, {
        productId: PRODUCT_ID,
      });
      expect(managerMock.update).not.toHaveBeenCalled();
    });

    it('publishes a product that has an image', async () => {
      managerMock.existsBy.mockResolvedValue(true);

      await service.update(PRODUCT_ID, { status: ProductStatus.Published });

      expect(managerMock.update).toHaveBeenCalledWith(
        Product,
        { id: PRODUCT_ID },
        { status: ProductStatus.Published },
      );
    });
  });

  describe('remove', () => {
    it('archives, soft deletes and empties carts in one transaction', async () => {
      await service.remove(PRODUCT_ID);

      expect(managerMock.update).toHaveBeenCalledWith(
        Product,
        { id: PRODUCT_ID },
        { status: ProductStatus.Archived, deletedAt: expect.any(Date) as Date },
      );
      expect(managerMock.delete).toHaveBeenCalledWith(CartItem, {
        productId: PRODUCT_ID,
      });
      expectCatalogCacheCleared();
    });

    it('answers 404 for a product that is already gone', async () => {
      managerMock.findOne.mockResolvedValue(null);

      await expect(service.remove(PRODUCT_ID)).rejects.toThrow(
        new NotFoundException('products.NOT_FOUND'),
      );
      expect(managerMock.update).not.toHaveBeenCalled();
    });
  });
});
