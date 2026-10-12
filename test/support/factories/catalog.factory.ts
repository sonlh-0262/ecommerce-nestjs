import { DeepPartial, Repository } from 'typeorm';

import { Category } from '../../../src/categories/entities/category.entity';
import { Product } from '../../../src/products/entities/product.entity';
import { ProductStatus } from '../../../src/products/enums/product-status.enum';
import { nextSequence } from './sequence';

export class CatalogFactory {
  constructor(
    private readonly categories: Repository<Category>,
    private readonly products: Repository<Product>,
  ) {}

  category(overrides: DeepPartial<Category> = {}): Promise<Category> {
    const sequence = nextSequence();

    return this.categories.save(
      this.categories.create({
        name: `Category ${sequence}`,
        slug: `category-${sequence}`,
        ...overrides,
      }),
    );
  }

  product(
    category: Category,
    overrides: DeepPartial<Product> = {},
  ): Promise<Product> {
    const sequence = nextSequence();

    return this.products.save(
      this.products.create({
        name: `Product ${sequence}`,
        slug: `product-${sequence}`,
        price: 100_000,
        stock: 10,
        status: ProductStatus.Published,
        categoryId: category.id,
        ...overrides,
      }),
    );
  }
}
