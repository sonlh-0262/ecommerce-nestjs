import { SelectQueryBuilder } from 'typeorm';

import { Category } from '../categories/entities/category.entity';
import { Product } from './entities/product.entity';
import { ProductSort } from './products.constants';

export const PRODUCT_ALIAS = 'product';

const EFFECTIVE_PRICE = 'COALESCE(product.salePrice, product.price)';

const SEARCH_QUERY = "websearch_to_tsquery('simple', immutable_unaccent(:q))";

const SORT_ORDERS: Record<ProductSort, [string, 'ASC' | 'DESC']> = {
  newest: ['product.createdAt', 'DESC'],
  price_asc: [EFFECTIVE_PRICE, 'ASC'],
  price_desc: [EFFECTIVE_PRICE, 'DESC'],
  best_selling: ['product.soldCount', 'DESC'],
  rating: ['product.averageRating', 'DESC'],
};

export interface ProductFilters {
  q?: string | null;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  inStock?: boolean;
}

export function filterProducts(
  builder: SelectQueryBuilder<Product>,
  filters: ProductFilters,
): SelectQueryBuilder<Product> {
  if (filters.q) {
    builder.andWhere(`product.searchVector @@ ${SEARCH_QUERY}`, {
      q: filters.q,
    });
  }

  if (filters.category) {
    const categoryIds = builder
      .subQuery()
      .select('filterCategory.id')
      .from(Category, 'filterCategory')
      .leftJoin('filterCategory.parent', 'filterParent')
      .where('filterCategory.slug = :category')
      .orWhere('filterParent.slug = :category')
      .getQuery();

    builder.andWhere(`product.categoryId IN ${categoryIds}`, {
      category: filters.category,
    });
  }

  if (filters.minPrice !== undefined) {
    builder.andWhere(`${EFFECTIVE_PRICE} >= :minPrice`, {
      minPrice: filters.minPrice,
    });
  }

  if (filters.maxPrice !== undefined) {
    builder.andWhere(`${EFFECTIVE_PRICE} <= :maxPrice`, {
      maxPrice: filters.maxPrice,
    });
  }

  if (filters.minRating !== undefined) {
    builder.andWhere('product.averageRating >= :minRating', {
      minRating: filters.minRating,
    });
  }

  if (filters.inStock !== undefined) {
    builder.andWhere(
      filters.inStock ? 'product.stock > 0' : 'product.stock = 0',
    );
  }

  return builder;
}

export function sortProducts(
  builder: SelectQueryBuilder<Product>,
  sort: ProductSort,
  q?: string | null,
): SelectQueryBuilder<Product> {
  if (q) {
    builder.addOrderBy(
      `ts_rank(product.searchVector, ${SEARCH_QUERY})`,
      'DESC',
    );
  }

  const [expression, direction] = SORT_ORDERS[sort];

  return builder
    .addOrderBy(expression, direction)
    .addOrderBy('product.id', 'DESC');
}
