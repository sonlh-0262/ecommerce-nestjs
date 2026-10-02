import { DeepPartial, Repository } from 'typeorm';

import { AuthService } from '../../../src/auth/auth.service';
import { User } from '../../../src/users/entities/user.entity';
import { UserStatus } from '../../../src/users/enums/user-status.enum';
import { PasswordService } from '../../../src/users/password.service';
import { SeededUser } from '../interfaces/seeded-user.interface';
import { SEEDED_USER_PASSWORD } from '../test.constants';
import { nextSequence } from './sequence';

export class UserFactory {
  constructor(
    private readonly users: Repository<User>,
    private readonly passwords: PasswordService,
    private readonly auth: AuthService,
  ) {}

  /**
   * Inserts directly rather than through the API, so a broken login reddens
   * the login tests and nothing else.
   *
   * Active by default, with a verification date to satisfy
   * `CHK_users_verified_status`; a case that wants a pending or locked account
   * overrides both.
   */
  async create(overrides: DeepPartial<User> = {}): Promise<User> {
    const sequence = nextSequence();

    return this.users.save(
      this.users.create({
        email: `user-${sequence}@example.com`,
        username: `user-${sequence}`,
        passwordHash: await this.passwords.hash(SEEDED_USER_PASSWORD),
        status: UserStatus.Active,
        emailVerifiedAt: new Date(),
        ...overrides,
      }),
    );
  }

  /**
   * The token comes from `AuthService` rather than a locally assembled JWT, so
   * the suite drives the endpoints with the tokens the app actually issues.
   */
  async createAuthenticated(
    overrides: DeepPartial<User> = {},
  ): Promise<SeededUser> {
    const user = await this.create(overrides);

    return {
      user,
      password: SEEDED_USER_PASSWORD,
      session: this.auth.issueSession(user),
    };
  }
}
