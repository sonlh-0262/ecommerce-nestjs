import { Command, CommandRunner, Option } from 'nest-commander';

import { SEED_COMMANDS } from '../console.constants';
import { SeedDemoOptions } from '../interfaces/seed-demo-options.interface';
import { DemoDataSeeder } from '../seeders/demo-data.seeder';

@Command({
  name: SEED_COMMANDS.demo,
  description:
    'Seed the demo data set: admin, catalogue, users, orders in every status and reviews.',
})
export class SeedDemoCommand extends CommandRunner {
  constructor(private readonly seeder: DemoDataSeeder) {
    super();
  }

  async run(_params: string[], options: SeedDemoOptions = {}): Promise<void> {
    await this.seeder.seed(options);
  }

  @Option({
    flags: '--fresh',
    description: 'Empty every table, the cache and the file storage first.',
  })
  parseFresh(): boolean {
    return true;
  }
}
