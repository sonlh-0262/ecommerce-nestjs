import { Logger } from '@nestjs/common';

import { UserStatus } from '../../users/enums/user-status.enum';
import { PasswordService } from '../../users/password.service';
import { UsersService } from '../../users/users.service';
import { SeedAccount } from './interfaces/seed-account.interface';
import { SEED_ACCOUNTS, SEED_PASSWORD } from './seed.constants';

/**
 * Creates the development accounts, skipping any that already exist.
 *
 * Idempotent on purpose: the command is run again after every
 * `migration:reset`, and on a database that was only partly seeded it has to
 * finish the job rather than fail on the first duplicate. Checking before
 * inserting is enough here, unlike in a request handler - one developer runs
 * this from a terminal, so there is no second caller to race with, and
 * `UQ_users_email` is still the thing that decides.
 *
 * A plain function rather than a provider - it needs two services and no
 * lifecycle, so there is nothing for the container to do here, and it stays
 * callable from a test without a module.
 */
export async function seedUsers(
  usersService: UsersService,
  passwordService: PasswordService,
  logger: Logger,
): Promise<void> {
  // Hashed once: bcrypt at the configured cost is the slow part, and every
  // seeded account shares the same password anyway.
  const passwordHash = await passwordService.hash(SEED_PASSWORD);

  for (const account of SEED_ACCOUNTS) {
    await seedAccount(usersService, account, passwordHash, logger);
  }
}

async function seedAccount(
  usersService: UsersService,
  account: SeedAccount,
  passwordHash: string,
  logger: Logger,
): Promise<void> {
  if (await usersService.findByEmail(account.email)) {
    logger.log(`${account.email} already exists, skipped`);

    return;
  }

  await usersService.create({
    ...account,
    passwordHash,
    status: UserStatus.Active,
    // Required by `CHK_users_verified_status` for an active account, and true
    // in spirit: a seeded account never had an email to confirm.
    emailVerifiedAt: new Date(),
  });

  logger.log(`Seeded ${account.role} ${account.email}`);
}
