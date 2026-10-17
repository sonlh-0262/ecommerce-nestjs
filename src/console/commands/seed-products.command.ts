import { Command, CommandRunner } from 'nest-commander';

import { SEED_COMMANDS } from '../console.constants';
import { ProductsSeeder } from '../seeders/products.seeder';

@Command({
  name: SEED_COMMANDS.products,
  description:
    'Create the sample products with placeholder images, skipping existing slugs.',
})
export class SeedProductsCommand extends CommandRunner {
  constructor(private readonly seeder: ProductsSeeder) {
    super();
  }

  async run(): Promise<void> {
    await this.seeder.seed();
  }
}
