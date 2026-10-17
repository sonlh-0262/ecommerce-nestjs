import { Logger } from '@nestjs/common';

import { DEMO_USERS } from '../../database/seeds/demo.seed-data';
import { SEED_PASSWORD } from '../../database/seeds/seed.constants';
import { buildUser } from '../../users/entities/user.fixture';
import { UserStatus } from '../../users/enums/user-status.enum';
import { CreateUserInput } from '../../users/interfaces/create-user-input.interface';
import { PasswordService } from '../../users/password.service';
import { UsersService } from '../../users/users.service';
import { DemoUsersSeeder } from './demo-users.seeder';

describe('DemoUsersSeeder', () => {
  const usersMock = { findByEmail: jest.fn(), create: jest.fn() };
  const passwordsMock = {
    hash: jest.fn((plain: string) => Promise.resolve(`hash:${plain}`)),
  };

  const seeder = new DemoUsersSeeder(
    usersMock as unknown as UsersService,
    passwordsMock as unknown as PasswordService,
  );

  const createdInputs = () =>
    (usersMock.create.mock.calls as [CreateUserInput][]).map(
      ([input]) => input,
    );

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    usersMock.findByEmail.mockResolvedValue(null);
    usersMock.create.mockImplementation((input: CreateUserInput) =>
      Promise.resolve(buildUser({ email: input.email, status: input.status })),
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('creates every demo account with the shared seed password', async () => {
    await seeder.seed();

    expect(passwordsMock.hash).toHaveBeenCalledTimes(1);
    expect(createdInputs().map(({ email }) => email)).toEqual(
      DEMO_USERS.map(({ email }) => email),
    );
    expect(
      createdInputs().every(
        ({ passwordHash }) => passwordHash === `hash:${SEED_PASSWORD}`,
      ),
    ).toBe(true);
  });

  it('verifies the active accounts and leaves the pending one unverified', async () => {
    await seeder.seed();

    for (const input of createdInputs()) {
      expect(input.emailVerifiedAt instanceof Date).toBe(
        input.status === UserStatus.Active,
      );
    }

    expect(
      createdInputs().filter(({ status }) => status === UserStatus.Pending),
    ).toHaveLength(1);
  });

  it('returns only the active accounts as buyers', async () => {
    const buyers = await seeder.seed();

    expect(buyers).toHaveLength(
      DEMO_USERS.filter(({ status }) => status === UserStatus.Active).length,
    );
    expect(buyers.every(({ status }) => status === UserStatus.Active)).toBe(
      true,
    );
  });

  it('reuses accounts that already exist', async () => {
    usersMock.findByEmail.mockImplementation((email: string) =>
      Promise.resolve(buildUser({ email, status: UserStatus.Active })),
    );

    const buyers = await seeder.seed();

    expect(usersMock.create).not.toHaveBeenCalled();
    expect(passwordsMock.hash).not.toHaveBeenCalled();
    expect(buyers).toHaveLength(DEMO_USERS.length);
  });
});
