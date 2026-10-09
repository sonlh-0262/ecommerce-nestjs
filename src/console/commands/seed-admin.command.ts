import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Command, CommandRunner } from 'nest-commander';

import { Environment } from '../../config/env.validation';
import { SEED_CONFIG_KEY, SeedConfig } from '../../config/seed.config';
import { SeedAdminAccount } from '../../database/seeds/interfaces/seed-admin-account.interface';
import { DEFAULT_SEED_ADMIN } from '../../database/seeds/seed.constants';
import { UserRole } from '../../users/enums/user-role.enum';
import { UserStatus } from '../../users/enums/user-status.enum';
import { PasswordService } from '../../users/password.service';
import {
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
} from '../../users/users.constants';
import { UsersService } from '../../users/users.service';
import { SEED_COMMANDS } from '../console.constants';
import { isProduction } from '../production-guard';

const NOT_USERNAME_CHARACTERS = /[^a-z0-9_]/g;

export function usernameFromEmail(email: string): string {
  const username = email
    .split('@')[0]
    .toLowerCase()
    .replace(NOT_USERNAME_CHARACTERS, '')
    .slice(0, USERNAME_MAX_LENGTH);

  return username.length >= USERNAME_MIN_LENGTH
    ? username
    : DEFAULT_SEED_ADMIN.username;
}

@Command({
  name: SEED_COMMANDS.admin,
  description: 'Create the admin account unless its email is already taken.',
})
export class SeedAdminCommand extends CommandRunner {
  private readonly logger = new Logger(SeedAdminCommand.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly passwordService: PasswordService,
    private readonly configService: ConfigService,
  ) {
    super();
  }

  async run(): Promise<void> {
    const account = this.account();

    if (await this.usersService.findByEmail(account.email)) {
      this.logger.log(`${account.email} already exists, left unchanged`);

      return;
    }

    await this.usersService.create({
      email: account.email,
      username: account.username,
      fullName: account.fullName,
      passwordHash: await this.passwordService.hash(account.password),
      role: UserRole.Admin,
      status: UserStatus.Active,
      emailVerifiedAt: new Date(),
    });

    this.logger.log(`Created admin ${account.email}`);
  }

  private account(): SeedAdminAccount {
    const { adminEmail, adminPassword } =
      this.configService.getOrThrow<SeedConfig>(SEED_CONFIG_KEY);

    if (isProduction(this.configService) && (!adminEmail || !adminPassword)) {
      throw new Error(
        `Refusing to seed the development admin with NODE_ENV=${Environment.Production}: ` +
          'its password is published. Set SEED_ADMIN_EMAIL and ' +
          'SEED_ADMIN_PASSWORD.',
      );
    }

    return {
      ...DEFAULT_SEED_ADMIN,
      ...(adminEmail
        ? { email: adminEmail, username: usernameFromEmail(adminEmail) }
        : {}),
      password: adminPassword ?? DEFAULT_SEED_ADMIN.password,
    };
  }
}
