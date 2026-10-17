import { Command, CommandRunner } from 'nest-commander';

import { SEED_COMMANDS } from '../console.constants';
import { AdminSeeder } from '../seeders/admin.seeder';

@Command({
  name: SEED_COMMANDS.admin,
  description: 'Create the admin account unless its email is already taken.',
})
export class SeedAdminCommand extends CommandRunner {
  constructor(private readonly seeder: AdminSeeder) {
    super();
  }

  async run(): Promise<void> {
    await this.seeder.seed();
  }
}
