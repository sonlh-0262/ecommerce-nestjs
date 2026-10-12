import {
  ConflictException,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { EntityManager, QueryFailedError, Repository } from 'typeorm';

import { CacheService } from '../cache/cache.service';
import { CACHE_RESOURCES } from '../common/constants/cache-keys';
import { PG_UNIQUE_VIOLATION } from '../database/database.constants';
import { transactionalDataSource } from '../database/transaction.fixture';
import { Product } from '../products/entities/product.entity';
import {
  MAX_DEPTH,
  UNIQUE_CATEGORIES_NAME_PARENT_INDEX,
} from './categories.constants';
import { CategoriesService } from './categories.service';
import { Category } from './entities/category.entity';

describe('CategoriesService', () => {
  const ROOT_ID = '00000000-0000-4000-8000-000000000001';
  const CHILD_ID = '00000000-0000-4000-8000-000000000002';
  const OTHER_ROOT_ID = '00000000-0000-4000-8000-000000000003';

  const category = (overrides: Partial<Category> = {}): Category =>
    ({
      id: ROOT_ID,
      name: 'Thời trang nam',
      slug: 'thoi-trang-nam',
      parentId: null,
      isActive: true,
      ...overrides,
    }) as Category;

  const root = category();
  const child = category({
    id: CHILD_ID,
    name: 'Áo nam',
    slug: 'ao-nam',
    parentId: ROOT_ID,
  });
  const otherRoot = category({
    id: OTHER_ROOT_ID,
    name: 'Thời trang nữ',
    slug: 'thoi-trang-nu',
  });

  const repositoryInTransaction = {
    create: jest.fn((input: Partial<Category>) => input),
    save: jest.fn((input: Partial<Category>) =>
      Promise.resolve({ id: 'new', ...input } as Category),
    ),
  };
  const managerMock = {
    find: jest.fn(),
    update: jest.fn(),
    exists: jest.fn(),
    existsBy: jest.fn(),
    delete: jest.fn(),
    getRepository: jest.fn(() => repositoryInTransaction),
  };
  const { dataSource } = transactionalDataSource(
    managerMock as unknown as EntityManager,
  );
  const categoriesRepository = { findOneBy: jest.fn(), existsBy: jest.fn() };
  const cacheMock = { invalidate: jest.fn() };
  const i18nMock = { t: jest.fn((key: string) => key) };

  let service: CategoriesService;

  const lockedRows = (...rows: Category[]) =>
    managerMock.find.mockResolvedValue(rows.map((row) => ({ ...row })));

  const expectCacheCleared = () =>
    expect(cacheMock.invalidate).toHaveBeenCalledWith(
      CACHE_RESOURCES.categories,
      CACHE_RESOURCES.products,
    );

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);

    service = new CategoriesService(
      categoriesRepository as unknown as Repository<Category>,
      dataSource,
      cacheMock as unknown as CacheService,
      i18nMock as unknown as I18nService,
    );

    categoriesRepository.existsBy.mockResolvedValue(false);
    managerMock.exists.mockResolvedValue(false);
    managerMock.existsBy.mockResolvedValue(false);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('creates a root category with a slug from its name', async () => {
      const created = await service.create({ name: 'Thời trang nam' });

      expect(created).toMatchObject({
        name: 'Thời trang nam',
        slug: 'thoi-trang-nam',
        parentId: null,
        isActive: true,
      });
      expect(managerMock.find).not.toHaveBeenCalled();
      expectCacheCleared();
    });

    it('appends a suffix when the slug is taken', async () => {
      categoriesRepository.existsBy.mockImplementation(
        ({ slug }: { slug: string }) =>
          Promise.resolve(slug === 'thoi-trang-nam'),
      );

      const created = await service.create({ name: 'Thời trang nam' });

      expect(created.slug).toBe('thoi-trang-nam-2');
    });

    it('nests under a root category it locks first', async () => {
      lockedRows(root);

      const created = await service.create({
        name: 'Áo nam',
        parentId: ROOT_ID,
      });

      expect(created.parentId).toBe(ROOT_ID);
      expect(managerMock.find).toHaveBeenCalledWith(
        Category,
        expect.objectContaining({ lock: { mode: 'pessimistic_write' } }),
      );
    });

    it('refuses a parent that does not exist with 422', async () => {
      lockedRows();

      await expect(
        service.create({ name: 'Áo nam', parentId: ROOT_ID }),
      ).rejects.toThrow(
        new UnprocessableEntityException('categories.PARENT_NOT_FOUND'),
      );
      expect(repositoryInTransaction.save).not.toHaveBeenCalled();
    });

    it('refuses a third level with 422', async () => {
      lockedRows(child);

      await expect(
        service.create({ name: 'Áo thun', parentId: CHILD_ID }),
      ).rejects.toThrow(
        new UnprocessableEntityException('categories.MAX_DEPTH_EXCEEDED'),
      );
      expect(i18nMock.t).toHaveBeenCalledWith('categories.MAX_DEPTH_EXCEEDED', {
        args: { maxDepth: MAX_DEPTH },
      });
    });

    it('turns a duplicate name under one parent into 409', async () => {
      repositoryInTransaction.save.mockRejectedValueOnce(
        new QueryFailedError('INSERT', [], {
          code: PG_UNIQUE_VIOLATION,
          constraint: UNIQUE_CATEGORIES_NAME_PARENT_INDEX,
        } as unknown as Error),
      );

      await expect(service.create({ name: 'Thời trang nam' })).rejects.toThrow(
        new ConflictException('categories.NAME_TAKEN'),
      );
      expect(cacheMock.invalidate).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('renames without touching the slug', async () => {
      lockedRows(root);

      const updated = await service.update(ROOT_ID, { name: 'Đồ nam' });

      expect(managerMock.update).toHaveBeenCalledWith(
        Category,
        { id: ROOT_ID },
        { name: 'Đồ nam' },
      );
      expect(updated.slug).toBe('thoi-trang-nam');
      expectCacheCleared();
    });

    it('answers 404 for an unknown category', async () => {
      lockedRows();

      await expect(service.update(ROOT_ID, { name: 'x' })).rejects.toThrow(
        new NotFoundException('categories.NOT_FOUND'),
      );
    });

    it('refuses the category as its own parent with 422', async () => {
      lockedRows(root);

      await expect(
        service.update(ROOT_ID, { parentId: ROOT_ID }),
      ).rejects.toThrow(
        new UnprocessableEntityException('categories.PARENT_IS_SELF'),
      );
    });

    it('refuses a parent that is itself a child with 422', async () => {
      lockedRows(otherRoot, child);

      await expect(
        service.update(OTHER_ROOT_ID, { parentId: CHILD_ID }),
      ).rejects.toThrow(
        new UnprocessableEntityException('categories.MAX_DEPTH_EXCEEDED'),
      );
    });

    it('refuses to nest a category that has children with 422', async () => {
      lockedRows(root, otherRoot);
      managerMock.existsBy.mockResolvedValue(true);

      await expect(
        service.update(ROOT_ID, { parentId: OTHER_ROOT_ID }),
      ).rejects.toThrow(
        new UnprocessableEntityException('categories.MAX_DEPTH_EXCEEDED'),
      );
      expect(managerMock.update).not.toHaveBeenCalled();
    });

    it('moves a child to the top level with parentId null', async () => {
      lockedRows(child);

      const updated = await service.update(CHILD_ID, { parentId: null });

      expect(updated.parentId).toBeNull();
      expect(managerMock.existsBy).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('deletes an empty category', async () => {
      lockedRows(root);

      await service.remove(ROOT_ID);

      expect(managerMock.delete).toHaveBeenCalledWith(Category, {
        id: ROOT_ID,
      });
      expectCacheCleared();
    });

    it('answers 404 for an unknown category', async () => {
      lockedRows();

      await expect(service.remove(ROOT_ID)).rejects.toThrow(
        new NotFoundException('categories.NOT_FOUND'),
      );
    });

    it('refuses while products, archived ones included, remain', async () => {
      lockedRows(root);
      managerMock.exists.mockResolvedValue(true);

      await expect(service.remove(ROOT_ID)).rejects.toThrow(
        new ConflictException('categories.HAS_PRODUCTS'),
      );
      expect(managerMock.exists).toHaveBeenCalledWith(Product, {
        where: { categoryId: ROOT_ID },
        withDeleted: true,
      });
      expect(managerMock.delete).not.toHaveBeenCalled();
      expect(cacheMock.invalidate).not.toHaveBeenCalled();
    });

    it('refuses while sub-categories remain', async () => {
      lockedRows(root);
      managerMock.existsBy.mockResolvedValue(true);

      await expect(service.remove(ROOT_ID)).rejects.toThrow(
        new ConflictException('categories.HAS_CHILDREN'),
      );
    });
  });
});
