import { Logger } from '@nestjs/common';

import { generateSlug } from '../../common/helpers/slug';
import { DEMO_MIN_STOCK } from '../../database/seeds/demo.seed-data';
import {
  SEED_PRODUCTS,
  seedProductAttributes,
} from '../../database/seeds/products.seed-data';
import { DEMO_ARCHIVED_EVERY } from '../../database/seeds/seed.constants';
import { Product } from '../../products/entities/product.entity';
import { ProductStatus } from '../../products/enums/product-status.enum';
import { SLUG_MAX_LENGTH } from '../../products/products.constants';
import { ProductsService } from '../../products/products.service';
import { DemoCatalogSeeder } from './demo-catalog.seeder';

describe('DemoCatalogSeeder', () => {
  const productsMock = { findBySlug: jest.fn(), update: jest.fn() };
  const seeder = new DemoCatalogSeeder(
    productsMock as unknown as ProductsService,
  );

  const slugOf = (name: string) => generateSlug(name, SLUG_MAX_LENGTH);

  const catalogue = new Map(
    SEED_PRODUCTS.map((seed, index) => {
      const { published, stock } = seedProductAttributes(index);
      const slug = slugOf(seed.name);

      return [
        slug,
        {
          id: `product:${index}`,
          slug,
          stock,
          status: published ? ProductStatus.Published : ProductStatus.Draft,
        } as Product,
      ];
    }),
  );

  const drafts = SEED_PRODUCTS.filter(
    (_seed, index) => !seedProductAttributes(index).published,
  );

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    productsMock.findBySlug.mockImplementation((slug: string) =>
      Promise.resolve(catalogue.get(slug) ?? null),
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  describe('archiveDrafts', () => {
    it('archives every other draft through the product service', async () => {
      await seeder.archiveDrafts();

      expect(productsMock.update).toHaveBeenCalledTimes(
        Math.ceil(drafts.length / DEMO_ARCHIVED_EVERY),
      );
      expect(productsMock.update).toHaveBeenCalledWith(
        catalogue.get(slugOf(drafts[0].name))?.id,
        { status: ProductStatus.Archived },
      );
    });

    it('leaves products that are no longer drafts alone', async () => {
      productsMock.findBySlug.mockResolvedValue({
        id: 'archived',
        status: ProductStatus.Archived,
      });

      await seeder.archiveDrafts();

      expect(productsMock.update).not.toHaveBeenCalled();
    });

    it('skips a product that is missing', async () => {
      productsMock.findBySlug.mockResolvedValue(null);

      await seeder.archiveDrafts();

      expect(productsMock.update).not.toHaveBeenCalled();
    });
  });

  describe('purchasable', () => {
    it('keeps the published products with enough stock for every buyer', async () => {
      const products = await seeder.purchasable();

      expect(products.length).toBeGreaterThan(0);
      expect(
        products.every(
          ({ status, stock }) =>
            status === ProductStatus.Published && stock >= DEMO_MIN_STOCK,
        ),
      ).toBe(true);
      expect(products).toHaveLength(
        [...catalogue.values()].filter(
          ({ status, stock }) =>
            status === ProductStatus.Published && stock >= DEMO_MIN_STOCK,
        ).length,
      );
    });

    it('drops products an admin has since hidden', async () => {
      productsMock.findBySlug.mockResolvedValue({
        status: ProductStatus.Draft,
        stock: 100,
      });

      await expect(seeder.purchasable()).resolves.toEqual([]);
    });
  });
});
