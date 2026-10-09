import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { I18nService } from 'nestjs-i18n';
import { DataSource, EntityManager, In, Repository } from 'typeorm';

import { CacheService } from '../cache/cache.service';
import { CACHE_RESOURCES } from '../common/constants/cache-keys';
import { definedFields } from '../common/helpers/defined-fields';
import { saveWithUniqueSlug, UniqueSlugOptions } from '../common/helpers/slug';
import { uniqueViolationConstraint } from '../database/unique-violation';
import { Product } from '../products/entities/product.entity';
import {
  CATEGORY_UNIQUE_CONFLICTS,
  MAX_DEPTH,
  SLUG_MAX_LENGTH,
  UNIQUE_CATEGORIES_SLUG_INDEX,
} from './categories.constants';
import { CreateCategoryBodyDto } from './dto/create-category.dto';
import { UpdateCategoryBodyDto } from './dto/update-category.dto';
import { Category } from './entities/category.entity';

@Injectable()
export class CategoriesService {
  private readonly logger = new Logger(CategoriesService.name);

  constructor(
    @InjectRepository(Category)
    private readonly categoriesRepository: Repository<Category>,
    private readonly dataSource: DataSource,
    private readonly cache: CacheService,
    private readonly i18n: I18nService,
  ) {}

  lockShared(manager: EntityManager, id: string): Promise<Category | null> {
    return manager.findOne(Category, {
      where: { id },
      lock: { mode: 'pessimistic_read' },
    });
  }

  findBySlug(slug: string): Promise<Category | null> {
    return this.categoriesRepository.findOneBy({ slug });
  }

  async create(input: CreateCategoryBodyDto): Promise<Category> {
    const category = await this.conflictOr(
      saveWithUniqueSlug(input.name, this.slugOptions(), (slug) =>
        this.dataSource.transaction(async (manager) => {
          if (input.parentId) {
            const [parent] = await this.lock(manager, [input.parentId]);

            this.assertCanParent(parent);
          }

          const repository = manager.getRepository(Category);

          return repository.save(
            repository.create({
              name: input.name,
              slug,
              parentId: input.parentId ?? null,
              isActive: input.isActive ?? true,
            }),
          );
        }),
      ),
    );

    await this.invalidateCache();
    this.logger.log(`Created category ${category.slug} (${category.id})`);

    return category;
  }

  async update(id: string, input: UpdateCategoryBodyDto): Promise<Category> {
    const patch = definedFields(input);

    const category = await this.conflictOr(
      this.dataSource.transaction(async (manager) => {
        const parentId = patch.parentId ?? null;
        const locked = await this.lock(manager, [id, parentId]);
        const category = this.found(locked.find((row) => row.id === id));

        if (parentId) {
          await this.assertCanMoveUnder(
            manager,
            category,
            locked.find((row) => row.id === parentId),
          );
        }

        await manager.update(Category, { id }, patch);

        return Object.assign(category, patch);
      }),
    );

    await this.invalidateCache();
    this.logger.log(`Updated category ${category.slug} (${category.id})`);

    return category;
  }

  async remove(id: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const [category] = await this.lock(manager, [id]);

      this.found(category);

      if (
        await manager.exists(Product, {
          where: { categoryId: id },
          withDeleted: true,
        })
      ) {
        throw new ConflictException(this.i18n.t('categories.HAS_PRODUCTS'));
      }

      if (await manager.existsBy(Category, { parentId: id })) {
        throw new ConflictException(this.i18n.t('categories.HAS_CHILDREN'));
      }

      await manager.delete(Category, { id });
    });

    await this.invalidateCache();
    this.logger.log(`Deleted category ${id}`);
  }

  private lock(
    manager: EntityManager,
    ids: (string | null)[],
  ): Promise<Category[]> {
    const wanted = [...new Set(ids.filter((id) => id !== null))];

    return manager.find(Category, {
      where: { id: In(wanted) },
      order: { id: 'ASC' },
      lock: { mode: 'pessimistic_write' },
    });
  }

  private found(category: Category | undefined): Category {
    if (!category) {
      throw new NotFoundException(this.i18n.t('categories.NOT_FOUND'));
    }

    return category;
  }

  private async assertCanMoveUnder(
    manager: EntityManager,
    category: Category,
    parent: Category | undefined,
  ): Promise<void> {
    if (parent?.id === category.id) {
      throw new UnprocessableEntityException(
        this.i18n.t('categories.PARENT_IS_SELF'),
      );
    }

    this.assertCanParent(parent);

    if (await manager.existsBy(Category, { parentId: category.id })) {
      throw this.tooDeep();
    }
  }

  private assertCanParent(parent: Category | undefined): void {
    if (!parent) {
      throw new UnprocessableEntityException(
        this.i18n.t('categories.PARENT_NOT_FOUND'),
      );
    }

    if (parent.parentId !== null) {
      throw this.tooDeep();
    }
  }

  private tooDeep(): UnprocessableEntityException {
    return new UnprocessableEntityException(
      this.i18n.t('categories.MAX_DEPTH_EXCEEDED', {
        args: { maxDepth: MAX_DEPTH },
      }),
    );
  }

  private slugOptions(): UniqueSlugOptions {
    return {
      maxLength: SLUG_MAX_LENGTH,
      constraint: UNIQUE_CATEGORIES_SLUG_INDEX,
      exists: (slug) => this.categoriesRepository.existsBy({ slug }),
    };
  }

  private async conflictOr<T>(pending: Promise<T>): Promise<T> {
    try {
      return await pending;
    } catch (error) {
      const constraint = uniqueViolationConstraint(error);
      const messageKey = constraint && CATEGORY_UNIQUE_CONFLICTS[constraint];

      throw messageKey ? new ConflictException(this.i18n.t(messageKey)) : error;
    }
  }

  private invalidateCache(): Promise<void> {
    return this.cache.invalidate(
      CACHE_RESOURCES.categories,
      CACHE_RESOURCES.products,
    );
  }
}
