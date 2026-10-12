import {
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { I18nService } from 'nestjs-i18n';
import { DataSource, EntityManager, Repository } from 'typeorm';

import { CacheService } from '../cache/cache.service';
import { CartItem } from '../cart/entities/cart-item.entity';
import { CategoriesService } from '../categories/categories.service';
import { CACHE_RESOURCES } from '../common/constants/cache-keys';
import { definedFields } from '../common/helpers/defined-fields';
import { saveWithUniqueSlug } from '../common/helpers/slug';
import { CreateProductBodyDto } from './dto/create-product.dto';
import { UpdateProductBodyDto } from './dto/update-product.dto';
import { ProductImage } from './entities/product-image.entity';
import { Product } from './entities/product.entity';
import { ProductStatus } from './enums/product-status.enum';
import {
  RESERVED_PRODUCT_SLUGS,
  SLUG_MAX_LENGTH,
  UNIQUE_PRODUCTS_SLUG_INDEX,
} from './products.constants';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
    private readonly dataSource: DataSource,
    private readonly categoriesService: CategoriesService,
    private readonly cache: CacheService,
    private readonly i18n: I18nService,
  ) {}

  findBySlug(slug: string): Promise<Product | null> {
    return this.productsRepository.findOneBy({ slug });
  }

  async create(input: CreateProductBodyDto): Promise<Product> {
    const status = input.status ?? ProductStatus.Draft;
    const salePrice = input.salePrice ?? null;

    this.assertSalePrice(input.price, salePrice);

    if (status === ProductStatus.Published) {
      throw this.noImages();
    }

    const product = await saveWithUniqueSlug(
      input.name,
      {
        maxLength: SLUG_MAX_LENGTH,
        constraint: UNIQUE_PRODUCTS_SLUG_INDEX,
        reserved: RESERVED_PRODUCT_SLUGS,
        exists: (slug) => this.productsRepository.existsBy({ slug }),
      },
      (slug) =>
        this.dataSource.transaction(async (manager) => {
          await this.assertCategoryExists(manager, input.categoryId);

          const repository = manager.getRepository(Product);

          return repository.save(
            repository.create({
              ...input,
              slug,
              description: input.description ?? null,
              salePrice,
              status,
              isFeatured: input.isFeatured ?? false,
            }),
          );
        }),
    );

    await this.invalidateCache();
    this.logger.log(`Created product ${product.slug} (${product.id})`);

    return product;
  }

  async update(id: string, input: UpdateProductBodyDto): Promise<Product> {
    const patch = definedFields(input);

    const product = await this.dataSource.transaction(async (manager) => {
      const current = await this.lock(manager, id);

      if (
        patch.categoryId !== undefined &&
        patch.categoryId !== current.categoryId
      ) {
        await this.assertCategoryExists(manager, patch.categoryId);
      }

      this.assertSalePrice(
        patch.price ?? current.price,
        patch.salePrice !== undefined ? patch.salePrice : current.salePrice,
      );

      if (
        patch.status === ProductStatus.Published &&
        current.status !== ProductStatus.Published &&
        !(await manager.existsBy(ProductImage, { productId: id }))
      ) {
        throw this.noImages();
      }

      await manager.update(Product, { id }, patch);

      return manager.findOneByOrFail(Product, { id });
    });

    await this.invalidateCache();
    this.logger.log(`Updated product ${product.slug} (${product.id})`);

    return product;
  }

  async remove(id: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await this.lock(manager, id);
      await manager.update(
        Product,
        { id },
        { status: ProductStatus.Archived, deletedAt: new Date() },
      );
      await manager.delete(CartItem, { productId: id });
    });

    await this.invalidateCache();
    this.logger.log(`Archived product ${id}`);
  }

  async lock(manager: EntityManager, id: string): Promise<Product> {
    const product = await manager.findOne(Product, {
      where: { id },
      lock: { mode: 'pessimistic_write' },
    });

    if (!product) {
      throw new NotFoundException(this.i18n.t('products.NOT_FOUND'));
    }

    return product;
  }

  invalidateCache(): Promise<void> {
    return this.cache.invalidate(
      CACHE_RESOURCES.products,
      CACHE_RESOURCES.categories,
    );
  }

  private async assertCategoryExists(
    manager: EntityManager,
    categoryId: string,
  ): Promise<void> {
    if (!(await this.categoriesService.lockShared(manager, categoryId))) {
      throw new UnprocessableEntityException(
        this.i18n.t('products.CATEGORY_NOT_FOUND'),
      );
    }
  }

  private assertSalePrice(price: number, salePrice: number | null): void {
    if (salePrice !== null && salePrice >= price) {
      throw new UnprocessableEntityException(
        this.i18n.t('products.SALE_PRICE_TOO_HIGH'),
      );
    }
  }

  private noImages(): UnprocessableEntityException {
    return new UnprocessableEntityException(this.i18n.t('products.NO_IMAGES'));
  }
}
