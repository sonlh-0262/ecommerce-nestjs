import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { I18nService } from 'nestjs-i18n';
import { In, Repository, SelectQueryBuilder } from 'typeorm';

import { CacheService } from '../cache/cache.service';
import { Category } from '../categories/entities/category.entity';
import { CACHE_RESOURCES } from '../common/constants/cache-keys';
import { paginated } from '../common/helpers/paginated';
import { ShopsViewService, shopIn } from '../shops/shops-view.service';
import { AdminProductsQueryDto } from './dto/admin-products-query.dto';
import {
  ProductResponseDto,
  ProductsResponseDto,
  ProductSummaryDto,
  toProductResponse,
  toProductSummary,
} from './dto/product.dto';
import {
  FeaturedProductsQueryDto,
  ProductsQueryDto,
} from './dto/products-query.dto';
import { SellerProductsQueryDto } from './dto/seller-product.dto';
import { ProductImage } from './entities/product-image.entity';
import { Product } from './entities/product.entity';
import { ProductStatus } from './enums/product-status.enum';
import { ProductThumbnailsService } from './product-thumbnails.service';
import { FEATURED_PRODUCTS_CACHE_TTL_SECONDS } from './products.constants';
import {
  filterProducts,
  PRODUCT_ALIAS,
  sortProducts,
} from './products-query.builder';

@Injectable()
export class ProductsViewService {
  constructor(
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
    @InjectRepository(ProductImage)
    private readonly imagesRepository: Repository<ProductImage>,
    @InjectRepository(Category)
    private readonly categoriesRepository: Repository<Category>,
    private readonly thumbnails: ProductThumbnailsService,
    private readonly shops: ShopsViewService,
    private readonly cache: CacheService,
    private readonly i18n: I18nService,
  ) {}

  list(query: ProductsQueryDto): Promise<ProductsResponseDto> {
    const builder = sortProducts(
      filterProducts(this.published(), query),
      query.sort,
      query.q,
    );

    return this.page(builder, query.limit, query.offset);
  }

  adminList(query: AdminProductsQueryDto): Promise<ProductsResponseDto> {
    return this.managedList(
      this.productsRepository.createQueryBuilder(PRODUCT_ALIAS),
      query,
    );
  }

  shopList(
    shopId: string,
    query: SellerProductsQueryDto,
  ): Promise<ProductsResponseDto> {
    return this.managedList(
      this.productsRepository
        .createQueryBuilder(PRODUCT_ALIAS)
        .where('product.shopId = :shopId', { shopId }),
      query,
    );
  }

  featured(query: FeaturedProductsQueryDto): Promise<ProductsResponseDto> {
    return this.cache.getOrSet(
      CACHE_RESOURCES.products,
      ['featured', query.limit, query.offset],
      FEATURED_PRODUCTS_CACHE_TTL_SECONDS,
      () =>
        this.page(
          this.published()
            .andWhere('product.isFeatured = true')
            .orderBy('product.soldCount', 'DESC')
            .addOrderBy('product.id', 'DESC'),
          query.limit,
          query.offset,
        ),
    );
  }

  async findPublishedBySlug(slug: string): Promise<ProductResponseDto> {
    const product = await this.productsRepository.findOneBy({
      slug,
      status: ProductStatus.Published,
    });

    if (!product) {
      throw new NotFoundException(this.i18n.t('products.NOT_FOUND'));
    }

    return this.toResponse(product);
  }

  async toResponse(product: Product): Promise<ProductResponseDto> {
    const [category, images, shops] = await Promise.all([
      this.categoriesRepository.findOneOrFail({
        where: { id: product.categoryId },
        relations: { parent: true },
      }),
      this.imagesRepository.find({
        where: { productId: product.id },
        relations: { attachment: true },
        order: { position: 'ASC' },
      }),
      this.shops.byIds([product.shopId]),
    ]);

    return toProductResponse(
      product,
      category,
      images,
      shopIn(shops, product.shopId),
    );
  }

  private managedList(
    builder: SelectQueryBuilder<Product>,
    query: AdminProductsQueryDto,
  ): Promise<ProductsResponseDto> {
    if (query.includeDeleted) {
      builder.withDeleted();
    }

    if (query.status) {
      builder.andWhere('product.status = :status', { status: query.status });
    }

    return this.page(
      sortProducts(filterProducts(builder, query), query.sort, query.q),
      query.limit,
      query.offset,
    );
  }

  private async page(
    builder: SelectQueryBuilder<Product>,
    limit: number,
    offset: number,
  ): Promise<ProductsResponseDto> {
    const [products, total] = await builder
      .offset(offset)
      .limit(limit)
      .getManyAndCount();

    return paginated('products', await this.toSummaries(products), total);
  }

  private published(): SelectQueryBuilder<Product> {
    return this.productsRepository
      .createQueryBuilder(PRODUCT_ALIAS)
      .where('product.status = :published', {
        published: ProductStatus.Published,
      });
  }

  private async toSummaries(products: Product[]): Promise<ProductSummaryDto[]> {
    if (products.length === 0) {
      return [];
    }

    const categoryIds = [...new Set(products.map((p) => p.categoryId))];
    const [thumbnailUrls, categories, shops] = await Promise.all([
      this.thumbnails.urlsOf(products.map(({ id }) => id)),
      this.categoriesRepository.findBy({ id: In(categoryIds) }),
      this.shops.byIds(products.map(({ shopId }) => shopId)),
    ]);

    const categoriesById = new Map(categories.map((c) => [c.id, c]));

    return products.map((product) =>
      toProductSummary(
        product,
        categoriesById.get(product.categoryId) as Category,
        thumbnailUrls.get(product.id) ?? null,
        shopIn(shops, product.shopId),
      ),
    );
  }
}
