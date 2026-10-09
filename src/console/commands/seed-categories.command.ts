import { Logger } from '@nestjs/common';
import { Command, CommandRunner } from 'nest-commander';

import { SLUG_MAX_LENGTH } from '../../categories/categories.constants';
import { CategoriesService } from '../../categories/categories.service';
import { Category } from '../../categories/entities/category.entity';
import { generateSlug } from '../../common/helpers/slug';
import { SEED_CATEGORIES } from '../../database/seeds/categories.seed-data';
import { SEED_COMMANDS } from '../console.constants';

@Command({
  name: SEED_COMMANDS.categories,
  description: 'Create the sample category tree, skipping existing slugs.',
})
export class SeedCategoriesCommand extends CommandRunner {
  private readonly logger = new Logger(SeedCategoriesCommand.name);

  constructor(private readonly categoriesService: CategoriesService) {
    super();
  }

  async run(): Promise<void> {
    const created: Category[] = [];

    for (const root of SEED_CATEGORIES) {
      const parent = await this.ensure(root.name, null, created);

      for (const child of root.children) {
        await this.ensure(child, parent.id, created);
      }
    }

    this.logger.log(`Created ${created.length} categories`);
  }

  private async ensure(
    name: string,
    parentId: string | null,
    created: Category[],
  ): Promise<Category> {
    const existing = await this.categoriesService.findBySlug(
      generateSlug(name, SLUG_MAX_LENGTH),
    );

    if (existing) {
      return existing;
    }

    const category = await this.categoriesService.create({
      name,
      parentId: parentId ?? undefined,
    });

    created.push(category);

    return category;
  }
}
