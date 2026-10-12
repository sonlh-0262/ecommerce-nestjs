import { DataSource, SelectQueryBuilder } from 'typeorm';

import { offlineDataSource } from '../database/offline-data-source.fixture';
import { Product } from './entities/product.entity';
import { PRODUCT_SORTS, ProductSort } from './products.constants';
import {
  filterProducts,
  PRODUCT_ALIAS,
  ProductFilters,
  sortProducts,
} from './products-query.builder';

describe('products query builder', () => {
  const EFFECTIVE_PRICE = 'COALESCE("product"."sale_price", "product"."price")';
  const SEARCH = "websearch_to_tsquery('simple', immutable_unaccent($1))";

  let dataSource: DataSource;

  beforeAll(async () => {
    dataSource = await offlineDataSource();
  });

  const builder = (): SelectQueryBuilder<Product> =>
    dataSource.getRepository(Product).createQueryBuilder(PRODUCT_ALIAS);

  const filtered = (filters: ProductFilters) => {
    const [sql, parameters] = filterProducts(
      builder(),
      filters,
    ).getQueryAndParameters();

    return { where: sql.slice(sql.indexOf(' WHERE ')), parameters };
  };

  const orderOf = (sort: ProductSort, q?: string) => {
    const sql = sortProducts(builder(), sort, q).getQuery();

    return sql.slice(sql.indexOf(' ORDER BY '));
  };

  describe('filterProducts', () => {
    it('adds nothing beyond the soft-delete guard without filters', () => {
      expect(filtered({}).where).toBe(' WHERE "product"."deleted_at" IS NULL');
    });

    it('matches the generated search column with the same expression', () => {
      const { where, parameters } = filtered({ q: 'ao thun' });

      expect(where).toContain(`"product"."search_vector" @@ ${SEARCH}`);
      expect(parameters).toEqual(['ao thun']);
    });

    it('filters a category together with its sub-categories', () => {
      const { where, parameters } = filtered({ category: 'thoi-trang-nam' });

      expect(where).toContain('"product"."category_id" IN (SELECT');
      expect(where).toContain('"filterCategory"."slug" = $1');
      expect(where).toContain('OR "filterParent"."slug" = $1');
      expect(where).toContain(
        'LEFT JOIN "public"."categories" "filterParent" ON "filterParent"."id"="filterCategory"."parent_id"',
      );
      expect(parameters).toEqual(['thoi-trang-nam']);
    });

    it('compares both price bounds to the effective price', () => {
      const { where, parameters } = filtered({
        minPrice: 100000,
        maxPrice: 500000,
      });

      expect(where).toContain(`${EFFECTIVE_PRICE} >= $1`);
      expect(where).toContain(`${EFFECTIVE_PRICE} <= $2`);
      expect(parameters).toEqual([100000, 500000]);
    });

    it('keeps a zero price bound', () => {
      expect(filtered({ minPrice: 0 }).where).toContain(
        `${EFFECTIVE_PRICE} >= $1`,
      );
    });

    it('filters on the average rating', () => {
      const { where, parameters } = filtered({ minRating: 4 });

      expect(where).toContain('"product"."average_rating" >= $1');
      expect(parameters).toEqual([4]);
    });

    it.each([
      [true, '"product"."stock" > 0'],
      [false, '"product"."stock" = 0'],
    ])('reads inStock=%p as %s', (inStock, condition) => {
      expect(filtered({ inStock }).where).toContain(condition);
    });
  });

  describe('sortProducts', () => {
    it.each<[ProductSort, string]>([
      ['newest', '"product"."created_at" DESC'],
      ['price_asc', `${EFFECTIVE_PRICE} ASC`],
      ['price_desc', `${EFFECTIVE_PRICE} DESC`],
      ['best_selling', '"product"."sold_count" DESC'],
      ['rating', '"product"."average_rating" DESC'],
    ])('orders %s by %s, then by id', (sort, order) => {
      expect(orderOf(sort)).toBe(` ORDER BY ${order}, "product"."id" DESC`);
    });

    it('covers every sort the API accepts', () => {
      for (const sort of PRODUCT_SORTS) {
        expect(orderOf(sort)).toMatch(/^ ORDER BY /);
      }
    });

    it('ranks by relevance first when searching', () => {
      expect(orderOf('price_asc', 'ao thun')).toBe(
        ` ORDER BY ts_rank("product"."search_vector", ${SEARCH.replace('$1', ':q')}) DESC, ` +
          `${EFFECTIVE_PRICE} ASC, "product"."id" DESC`,
      );
    });
  });
});
