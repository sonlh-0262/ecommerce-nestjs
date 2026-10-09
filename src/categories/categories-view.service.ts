import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { I18nService } from 'nestjs-i18n';
import { IsNull, Repository } from 'typeorm';

import { CacheService } from '../cache/cache.service';
import { CACHE_RESOURCES } from '../common/constants/cache-keys';
import { paginated } from '../common/helpers/paginated';
import { Product } from '../products/entities/product.entity';
import { ProductStatus } from '../products/enums/product-status.enum';
import {
  CATEGORIES_CACHE_TTL_SECONDS,
  ROOT_CATEGORIES_FILTER,
} from './categories.constants';
import { CategoriesQueryDto } from './dto/categories-query.dto';
import {
  CategoriesResponseDto,
  CategoryDetailResponseDto,
  CategoryResponseDto,
  toCategoryDto,
  toCategoryRef,
} from './dto/category.dto';
import { Category } from './entities/category.entity';

interface ProductCountRow {
  categoryId: string;
  productsCount: string;
}

@Injectable()
export class CategoriesViewService {
  constructor(
    @InjectRepository(Category)
    private readonly categoriesRepository: Repository<Category>,
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
    private readonly cache: CacheService,
    private readonly i18n: I18nService,
  ) {}

  list(query: CategoriesQueryDto): Promise<CategoriesResponseDto> {
    return this.cache.getOrSet(
      CACHE_RESOURCES.categories,
      [
        'list',
        query.parentId ?? 'any',
        query.isActive ?? 'any',
        query.limit,
        query.offset,
      ],
      CATEGORIES_CACHE_TTL_SECONDS,
      () => this.loadList(query),
    );
  }

  async findBySlug(slug: string): Promise<CategoryDetailResponseDto> {
    const category = await this.categoriesRepository.findOne({
      where: { slug },
      relations: { parent: true },
    });

    if (!category) {
      throw new NotFoundException(this.i18n.t('categories.NOT_FOUND'));
    }

    const children = await this.categoriesRepository.find({
      where: { parentId: category.id },
      order: { name: 'ASC', id: 'ASC' },
    });
    const counts = await this.productCounts([
      category.id,
      ...children.map(({ id }) => id),
    ]);

    return {
      category: {
        ...toCategoryDto(category, counts.get(category.id) ?? 0),
        parent: category.parent ? toCategoryRef(category.parent) : null,
        children: children.map((child) =>
          toCategoryDto(child, counts.get(child.id) ?? 0),
        ),
      },
    };
  }

  async toResponse(category: Category): Promise<CategoryResponseDto> {
    const counts = await this.productCounts([category.id]);

    return { category: toCategoryDto(category, counts.get(category.id) ?? 0) };
  }

  private async loadList(
    query: CategoriesQueryDto,
  ): Promise<CategoriesResponseDto> {
    const [categories, total] = await this.categoriesRepository.findAndCount({
      where: {
        ...(query.parentId !== undefined
          ? {
              parentId:
                query.parentId === ROOT_CATEGORIES_FILTER
                  ? IsNull()
                  : query.parentId,
            }
          : {}),
        ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      },
      order: { name: 'ASC', id: 'ASC' },
      skip: query.offset,
      take: query.limit,
    });
    const counts = await this.productCounts(categories.map(({ id }) => id));

    return paginated(
      'categories',
      categories.map((category) =>
        toCategoryDto(category, counts.get(category.id) ?? 0),
      ),
      total,
    );
  }

  private async productCounts(ids: string[]): Promise<Map<string, number>> {
    if (ids.length === 0) {
      return new Map();
    }

    const rows = await this.productsRepository
      .createQueryBuilder('product')
      .select('product.categoryId', 'categoryId')
      .addSelect('COUNT(*)', 'productsCount')
      .where('product.categoryId IN (:...ids)', { ids })
      .andWhere('product.status = :published', {
        published: ProductStatus.Published,
      })
      .groupBy('product.categoryId')
      .getRawMany<ProductCountRow>();

    return new Map(
      rows.map((row) => [row.categoryId, Number(row.productsCount)]),
    );
  }
}
