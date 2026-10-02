import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from '../../app.module';
import { PasswordService } from '../../users/password.service';
import { UsersService } from '../../users/users.service';
import { FORBIDDEN_SEED_ENVIRONMENT, SEED_PASSWORD } from './seed.constants';
import { seedUsers } from './users.seed';

/**
 * `npm run seed` - the console entry point for the seeders.
 *
 * Boots the real `AppModule` as an application context (no HTTP listener), so
 * the seeders get the same configuration, validation and database connection
 * the API runs with instead of a second copy that could drift from it.
 */
async function run(): Promise<void> {
  const logger = new Logger('Seed');

  if (process.env.NODE_ENV === FORBIDDEN_SEED_ENVIRONMENT) {
    logger.error(
      `Refusing to seed with NODE_ENV=${FORBIDDEN_SEED_ENVIRONMENT}: ` +
        `the seeded accounts share one published password.`,
    );
    process.exitCode = 1;

    return;
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'error', 'warn'],
  });

  try {
    await seedUsers(app.get(UsersService), app.get(PasswordService), logger);
    logger.log(`Done. Every seeded account uses the password ${SEED_PASSWORD}`);
  } finally {
    // In a `finally` so a failed seeder still releases the database and Redis
    // connections; without this the command hangs instead of reporting.
    await app.close();
  }
}

void run();
