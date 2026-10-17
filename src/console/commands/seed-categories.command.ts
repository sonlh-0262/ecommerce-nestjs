import { Command, CommandRunner } from 'nest-commander';

import { SEED_COMMANDS } from '../console.constants';
import { CategoriesSeeder } from '../seeders/categories.seeder';

@Command({
  name: SEED_COMMANDS.categories,
  description: 'Create the sample category tree, skipping existing slugs.',
})
export class SeedCategoriesCommand extends CommandRunner {
  constructor(private readonly seeder: CategoriesSeeder) {
    super();
  }

  async run(): Promise<void> {
    await this.seeder.seed();
  }
}
