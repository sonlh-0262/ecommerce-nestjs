import { NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { IsNull, Repository } from 'typeorm';

import { CacheService } from '../cache/cache.service';
import { CACHE_RESOURCES } from '../common/constants/cache-keys';
import { Product } from '../products/entities/product.entity';
import { ProductStatus } from '../products/enums/product-status.enum';
import {
  CATEGORIES_CACHE_TTL_SECONDS,
  ROOT_CATEGORIES_FILTER,
} from './categories.constants';
import { CategoriesViewService } from './categories-view.service';
import { CategoriesQueryDto } from './dto/categories-query.dto';
import { Category } from './entities/category.entity';

describe('CategoriesViewService', () => {
  const root = {
    id: 'root',
    name: 'Thời trang nam',
    slug: 'thoi-trang-nam',
    parentId: null,
    parent: null,
    isActive: true,
  } as Category;
  const child = {
    id: 'child',
    name: 'Áo nam',
    slug: 'ao-nam',
    parentId: 'root',
    parent: root,
    isActive: false,
  } as Category;

  const countsBuilder = {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    getRawMany: jest.fn(),
  };
  const categoriesRepository = {
    findAndCount: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
  };
  const productsRepository = {
    createQueryBuilder: jest.fn(() => countsBuilder),
  };
  const cacheMock = {
    getOrSet: jest.fn(
      (
        _resource: string,
        _variant: unknown[],
        _ttl: number,
        factory: () => Promise<unknown>,
      ) => factory(),
    ),
  };
  const i18nMock = { t: jest.fn((key: string) => key) };

  let service: CategoriesViewService;

  const query = (overrides: Partial<CategoriesQueryDto> = {}) =>
    Object.assign(new CategoriesQueryDto(), overrides);

  beforeEach(() => {
    service = new CategoriesViewService(
      categoriesRepository as unknown as Repository<Category>,
      productsRepository as unknown as Repository<Product>,
      cacheMock as unknown as CacheService,
      i18nMock as unknown as I18nService,
    );

    countsBuilder.getRawMany.mockResolvedValue([
      { categoryId: 'root', productsCount: '3' },
    ]);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('list', () => {
    it('caches the page under a key naming every filter', async () => {
      categoriesRepository.findAndCount.mockResolvedValue([[], 0]);

      await service.list(query({ isActive: true, limit: 5, offset: 10 }));

      expect(cacheMock.getOrSet).toHaveBeenCalledWith(
        CACHE_RESOURCES.categories,
        ['list', 'any', true, 5, 10],
        CATEGORIES_CACHE_TTL_SECONDS,
        expect.any(Function),
      );
    });

    it('counts published products for the whole page in one query', async () => {
      categoriesRepository.findAndCount.mockResolvedValue([[root, child], 9]);

      const response = await service.list(query());

      expect(productsRepository.createQueryBuilder).toHaveBeenCalledTimes(1);
      expect(countsBuilder.where).toHaveBeenCalledWith(
        'product.categoryId IN (:...ids)',
        { ids: ['root', 'child'] },
      );
      expect(countsBuilder.andWhere).toHaveBeenCalledWith(
        'product.status = :published',
        { published: ProductStatus.Published },
      );
      expect(response).toEqual({
        categories: [
          expect.objectContaining({ id: 'root', productsCount: 3 }),
          expect.objectContaining({ id: 'child', productsCount: 0 }),
        ],
        categoriesCount: 9,
      });
    });

    it('lists the root categories for parentId=null', async () => {
      categoriesRepository.findAndCount.mockResolvedValue([[], 0]);

      await service.list(query({ parentId: ROOT_CATEGORIES_FILTER }));

      expect(categoriesRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: { parentId: IsNull() } }),
      );
    });

    it('skips the count query for an empty page', async () => {
      categoriesRepository.findAndCount.mockResolvedValue([[], 0]);

      await service.list(query({ parentId: 'root', isActive: false }));

      expect(categoriesRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { parentId: 'root', isActive: false },
        }),
      );
      expect(productsRepository.createQueryBuilder).not.toHaveBeenCalled();
    });
  });

  describe('findBySlug', () => {
    it('answers 404 for an unknown slug', async () => {
      categoriesRepository.findOne.mockResolvedValue(null);

      await expect(service.findBySlug('nope')).rejects.toThrow(
        new NotFoundException('categories.NOT_FOUND'),
      );
    });

    it('returns the category with its parent and children', async () => {
      categoriesRepository.findOne.mockResolvedValue(root);
      categoriesRepository.find.mockResolvedValue([child]);

      const { category } = await service.findBySlug('thoi-trang-nam');

      expect(category).toEqual({
        id: 'root',
        name: 'Thời trang nam',
        slug: 'thoi-trang-nam',
        parentId: null,
        isActive: true,
        productsCount: 3,
        parent: null,
        children: [
          {
            id: 'child',
            name: 'Áo nam',
            slug: 'ao-nam',
            parentId: 'root',
            isActive: false,
            productsCount: 0,
          },
        ],
      });
    });

    it('names the parent of a sub-category', async () => {
      categoriesRepository.findOne.mockResolvedValue(child);
      categoriesRepository.find.mockResolvedValue([]);

      const { category } = await service.findBySlug('ao-nam');

      expect(category.parent).toEqual({
        id: 'root',
        name: 'Thời trang nam',
        slug: 'thoi-trang-nam',
      });
    });
  });
});
