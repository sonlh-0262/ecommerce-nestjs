import { Injectable, Logger } from '@nestjs/common';

import { DEMO_USERS } from '../../database/seeds/demo.seed-data';
import { SeedDemoUser } from '../../database/seeds/interfaces/seed-demo-user.interface';
import { SEED_PASSWORD } from '../../database/seeds/seed.constants';
import { User } from '../../users/entities/user.entity';
import { UserStatus } from '../../users/enums/user-status.enum';
import { PasswordService } from '../../users/password.service';
import { UsersService } from '../../users/users.service';

@Injectable()
export class DemoUsersSeeder {
  private readonly logger = new Logger(DemoUsersSeeder.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly passwordService: PasswordService,
  ) {}

  async seed(): Promise<User[]> {
    let passwordHash: Promise<string> | undefined;
    const hash = () =>
      (passwordHash ??= this.passwordService.hash(SEED_PASSWORD));
    const users: User[] = [];

    for (const seed of DEMO_USERS) {
      users.push(await this.ensure(seed, hash));
    }

    return users.filter(({ status }) => status === UserStatus.Active);
  }

  private async ensure(
    seed: SeedDemoUser,
    hash: () => Promise<string>,
  ): Promise<User> {
    const existing = await this.usersService.findByEmail(seed.email);

    if (existing) {
      return existing;
    }

    const active = seed.status === UserStatus.Active;
    const user = await this.usersService.create({
      email: seed.email,
      username: seed.username,
      fullName: seed.fullName,
      passwordHash: await hash(),
      status: seed.status,
      emailVerifiedAt: active ? new Date() : null,
    });

    this.logger.log(`Created ${seed.status} demo user ${seed.email}`);

    return user;
  }
}
