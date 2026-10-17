import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { APP_CONFIG_KEY } from '../../config/configuration';
import { Environment } from '../../config/env.validation';
import { SEED_CONFIG_KEY, SeedConfig } from '../../config/seed.config';
import { DEFAULT_SEED_ADMIN } from '../../database/seeds/seed.constants';
import { buildUser } from '../../users/entities/user.fixture';
import { UserRole } from '../../users/enums/user-role.enum';
import { UserStatus } from '../../users/enums/user-status.enum';
import { CreateUserInput } from '../../users/interfaces/create-user-input.interface';
import { PasswordService } from '../../users/password.service';
import { USERNAME_MAX_LENGTH } from '../../users/users.constants';
import { UsersService } from '../../users/users.service';
import { AdminSeeder, usernameFromEmail } from './admin.seeder';

describe('AdminSeeder', () => {
  const usersServiceMock = { findByEmail: jest.fn(), create: jest.fn() };
  const passwordServiceMock = {
    hash: jest.fn((plain: string) => Promise.resolve(`hash:${plain}`)),
  };

  const seeder = (nodeEnv: Environment, seed: SeedConfig = {}) =>
    new AdminSeeder(
      usersServiceMock as unknown as UsersService,
      passwordServiceMock as unknown as PasswordService,
      {
        getOrThrow: (key: string) =>
          ({ [SEED_CONFIG_KEY]: seed, [APP_CONFIG_KEY]: { nodeEnv } })[key],
      } as unknown as ConfigService,
    );

  const created = () =>
    (usersServiceMock.create.mock.calls as [CreateUserInput][])[0][0];

  const OWNER = {
    adminEmail: 'owner@shop.example.com',
    adminPassword: 'S3cret-password',
  };

  beforeEach(() => {
    usersServiceMock.findByEmail.mockResolvedValue(null);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('creates an active, verified admin with the development account', async () => {
    await seeder(Environment.Development).seed();

    expect(created()).toMatchObject({
      email: DEFAULT_SEED_ADMIN.email,
      username: DEFAULT_SEED_ADMIN.username,
      passwordHash: `hash:${DEFAULT_SEED_ADMIN.password}`,
      role: UserRole.Admin,
      status: UserStatus.Active,
    });
    expect(created().emailVerifiedAt).toBeInstanceOf(Date);
  });

  it('uses the account the environment names', async () => {
    await seeder(Environment.Development, OWNER).seed();

    expect(created()).toMatchObject({
      email: OWNER.adminEmail,
      username: 'owner',
      passwordHash: `hash:${OWNER.adminPassword}`,
    });
  });

  it('leaves an existing account untouched, password included', async () => {
    usersServiceMock.findByEmail.mockResolvedValue(
      buildUser({ email: DEFAULT_SEED_ADMIN.email, role: UserRole.Admin }),
    );

    await seeder(Environment.Development).seed();

    expect(usersServiceMock.create).not.toHaveBeenCalled();
    expect(passwordServiceMock.hash).not.toHaveBeenCalled();
  });

  it('hands back the admin it created or found', async () => {
    const existing = buildUser({ role: UserRole.Admin });
    const fresh = buildUser({ role: UserRole.Admin });

    usersServiceMock.findByEmail.mockResolvedValueOnce(existing);
    usersServiceMock.create.mockResolvedValueOnce(fresh);

    await expect(seeder(Environment.Development).seed()).resolves.toBe(
      existing,
    );
    await expect(seeder(Environment.Development).seed()).resolves.toBe(fresh);
  });

  it.each([
    ['no account', {}],
    ['only an email', { adminEmail: OWNER.adminEmail }],
    ['only a password', { adminPassword: OWNER.adminPassword }],
  ])('refuses production with %s configured', async (_case, seed) => {
    await expect(seeder(Environment.Production, seed).seed()).rejects.toThrow(
      /SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD/,
    );

    expect(usersServiceMock.findByEmail).not.toHaveBeenCalled();
  });

  it('seeds production once both variables are set', async () => {
    await seeder(Environment.Production, OWNER).seed();

    expect(created().email).toBe(OWNER.adminEmail);
  });
});

describe('usernameFromEmail', () => {
  it('keeps the local part, lower-cased', () => {
    expect(usernameFromEmail('Shop_Owner@example.com')).toBe('shop_owner');
  });

  it('drops characters a username cannot hold', () => {
    expect(usernameFromEmail('shop.owner+1@example.com')).toBe('shopowner1');
  });

  it('falls back to the default when too little is left', () => {
    expect(usernameFromEmail('a.b@example.com')).toBe(
      DEFAULT_SEED_ADMIN.username,
    );
  });

  it('fits the column', () => {
    expect(usernameFromEmail(`${'a'.repeat(80)}@example.com`)).toHaveLength(
      USERNAME_MAX_LENGTH,
    );
  });
});
