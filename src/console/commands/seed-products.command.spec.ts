import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { CategoriesService } from '../../categories/categories.service';
import { APP_CONFIG_KEY } from '../../config/configuration';
import { Environment } from '../../config/env.validation';
import {
  SEED_PRODUCTS,
  seedProductAttributes,
} from '../../database/seeds/products.seed-data';
import { SEED_IMAGE_FILES } from '../../database/seeds/seed.constants';
import { ProductStatus } from '../../products/enums/product-status.enum';
import { ProductImagesService } from '../../products/product-images.service';
import { ProductsService } from '../../products/products.service';
import { SeedProductsCommand } from './seed-products.command';

describe('SeedProductsCommand', () => {
  const productsMock = {
    findBySlug: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };
  const imagesMock = { add: jest.fn() };
  const categoriesMock = { findBySlug: jest.fn() };

  const command = (nodeEnv = Environment.Development) =>
    new SeedProductsCommand(
      productsMock as unknown as ProductsService,
      imagesMock as unknown as ProductImagesService,
      categoriesMock as unknown as CategoriesService,
      {
        getOrThrow: (key: string) =>
          key === APP_CONFIG_KEY ? { nodeEnv } : undefined,
      } as unknown as ConfigService,
    );

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    productsMock.findBySlug.mockResolvedValue(null);
    categoriesMock.findBySlug.mockImplementation((slug: string) =>
      Promise.resolve({ id: `category:${slug}` }),
    );
    productsMock.create.mockImplementation((input: { name: string }) =>
      Promise.resolve({ id: `product:${input.name}` }),
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('creates every product as a draft, adds its images, then publishes', async () => {
    await command().run();

    const [first] = SEED_PRODUCTS;
    const published = SEED_PRODUCTS.filter(
      (_seed, index) => seedProductAttributes(index).published,
    );

    expect(productsMock.create).toHaveBeenCalledTimes(SEED_PRODUCTS.length);
    expect(productsMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: first.name,
        categoryId: 'category:ao-nam',
      }),
    );
    expect(
      (productsMock.create.mock.calls as [{ status?: unknown }][]).filter(
        ([input]) => input.status !== undefined,
      ),
    ).toEqual([]);
    expect(imagesMock.add).toHaveBeenCalledTimes(SEED_PRODUCTS.length);
    expect(productsMock.update).toHaveBeenCalledTimes(published.length);
    expect(productsMock.update).toHaveBeenCalledWith(expect.any(String), {
      status: ProductStatus.Published,
    });
    expect(
      Math.max(
        ...(imagesMock.add.mock.calls as [string, unknown[]][]).map(
          ([, images]) => images.length,
        ),
      ),
    ).toBe(SEED_IMAGE_FILES.length);
  });

  it('skips products whose slug already exists', async () => {
    productsMock.findBySlug.mockResolvedValue({ id: 'existing' });

    await command().run();

    expect(productsMock.create).not.toHaveBeenCalled();
  });

  it('fails when the categories have not been seeded', async () => {
    categoriesMock.findBySlug.mockResolvedValue(null);

    await expect(command().run()).rejects.toThrow(/seed:categories/);
  });

  it('refuses to run in production', async () => {
    await expect(command(Environment.Production).run()).rejects.toThrow(
      /NODE_ENV=production/,
    );
    expect(productsMock.findBySlug).not.toHaveBeenCalled();
  });
});

describe('seedProductAttributes', () => {
  const all = SEED_PRODUCTS.map((_seed, index) => seedProductAttributes(index));

  it('publishes four products in five and features ten published ones', () => {
    expect(all.filter((a) => a.published)).toHaveLength(40);
    expect(all.filter((a) => a.isFeatured && a.published)).toHaveLength(10);
  });

  it('prices between 50,000 and 5,000,000 VND, sales below the price', () => {
    for (const { price, salePrice } of all) {
      expect(price).toBeGreaterThanOrEqual(50_000);
      expect(price).toBeLessThanOrEqual(5_000_000);
      expect(Number.isInteger(price)).toBe(true);

      if (salePrice !== null) {
        expect(salePrice).toBeLessThan(price);
      }
    }
  });

  it('gives every product one to three images', () => {
    for (const { imageCount } of all) {
      expect(imageCount).toBeGreaterThanOrEqual(1);
      expect(imageCount).toBeLessThanOrEqual(SEED_IMAGE_FILES.length);
    }
  });

  it('is the same on every run', () => {
    expect(seedProductAttributes(17)).toEqual(seedProductAttributes(17));
  });
});
