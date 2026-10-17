import { Injectable, Logger } from '@nestjs/common';

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

@Injectable()
export class DemoCatalogSeeder {
  private readonly logger = new Logger(DemoCatalogSeeder.name);

  constructor(private readonly productsService: ProductsService) {}

  async archiveDrafts(): Promise<void> {
    const drafts = SEED_PRODUCTS.filter(
      (_seed, index) => !seedProductAttributes(index).published,
    ).filter((_seed, index) => index % DEMO_ARCHIVED_EVERY === 0);
    let archived = 0;

    for (const seed of drafts) {
      const product = await this.find(seed.name);

      if (product?.status === ProductStatus.Draft) {
        await this.productsService.update(product.id, {
          status: ProductStatus.Archived,
        });
        archived += 1;
      }
    }

    this.logger.log(`Archived ${archived} draft products`);
  }

  async purchasable(): Promise<Product[]> {
    const products = await Promise.all(
      SEED_PRODUCTS.filter(
        (_seed, index) => seedProductAttributes(index).published,
      ).map(({ name }) => this.find(name)),
    );

    return products.filter(
      (product): product is Product =>
        product?.status === ProductStatus.Published &&
        product.stock >= DEMO_MIN_STOCK,
    );
  }

  private find(name: string): Promise<Product | null> {
    return this.productsService.findBySlug(generateSlug(name, SLUG_MAX_LENGTH));
  }
}
