import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { I18nService } from 'nestjs-i18n';

import { AuthConfig } from '../../config/auth.config';
import { buildUser } from '../../users/entities/user.fixture';
import { UserStatus } from '../../users/enums/user-status.enum';
import { UsersService } from '../../users/users.service';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { TokenBlacklistService } from '../token-blacklist.service';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  const ISSUED_AT = 1_790_000_000;
  const CHANGED_AT = new Date('2026-10-05T00:00:00.500Z');

  let strategy: JwtStrategy;

  const usersServiceMock = { findById: jest.fn() };
  const tokenBlacklistMock = { isRevoked: jest.fn() };
  const i18nServiceMock = { t: jest.fn((key: string) => key) };
  const authConfig: AuthConfig = {
    jwtSecret: 'a-secret-long-enough-for-the-validation',
    jwtExpiresIn: '1d',
    jwtIssuer: 'ecommerce-api',
    bcryptSaltRounds: 10,
  };

  const payload = (overrides: Partial<JwtPayload> = {}): JwtPayload => ({
    sub: '0d3d3f4e-0000-4000-8000-000000000001',
    email: 'son@example.com',
    username: 'sonlh',
    pwv: null,
    jti: 'token-id',
    iat: ISSUED_AT,
    exp: ISSUED_AT + 86_400,
    ...overrides,
  });

  beforeEach(() => {
    // Instantiated directly rather than through the Nest container: the
    // Passport mixin reads its options in the constructor, so there is nothing
    // the container would contribute beyond passing the same four arguments.
    strategy = new JwtStrategy(
      usersServiceMock as unknown as UsersService,
      tokenBlacklistMock as unknown as TokenBlacklistService,
      i18nServiceMock as unknown as I18nService,
      { getOrThrow: () => authConfig } as unknown as ConfigService,
    );

    tokenBlacklistMock.isRevoked.mockResolvedValue(false);
    usersServiceMock.findById.mockResolvedValue(buildUser());
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns the account and the token identity for a live token', async () => {
    const result = await strategy.validate(payload());

    expect(result.user.username).toBe('sonlh');
    expect(result.jti).toBe('token-id');
    expect(result.expiresAt).toBe(ISSUED_AT + 86_400);
  });

  it('rejects a token that has been logged out', async () => {
    tokenBlacklistMock.isRevoked.mockResolvedValue(true);

    await expect(strategy.validate(payload())).rejects.toThrow(
      'auth.TOKEN_REVOKED',
    );
  });

  it('checks the denylist before loading the account', async () => {
    // One Redis lookup is cheaper than a row, and a revoked token never needs
    // the row at all.
    tokenBlacklistMock.isRevoked.mockResolvedValue(true);

    await expect(strategy.validate(payload())).rejects.toThrow(
      UnauthorizedException,
    );
    expect(usersServiceMock.findById).not.toHaveBeenCalled();
  });

  it('rejects a token whose account no longer exists', async () => {
    usersServiceMock.findById.mockResolvedValue(null);

    await expect(strategy.validate(payload())).rejects.toThrow(
      'auth.USER_NOT_FOUND',
    );
  });

  it('rejects a token issued before the password was changed', async () => {
    usersServiceMock.findById.mockResolvedValue(
      buildUser({ passwordChangedAt: CHANGED_AT }),
    );

    await expect(strategy.validate(payload())).rejects.toThrow(
      'auth.PASSWORD_CHANGED',
    );
  });

  it('accepts a token that carries the current password version', async () => {
    usersServiceMock.findById.mockResolvedValue(
      buildUser({ passwordChangedAt: CHANGED_AT }),
    );

    await expect(
      strategy.validate(payload({ pwv: CHANGED_AT.getTime() })),
    ).resolves.toMatchObject({ jti: 'token-id' });
  });

  it('rejects a token from before the latest of two changes', async () => {
    usersServiceMock.findById.mockResolvedValue(
      buildUser({ passwordChangedAt: new Date(CHANGED_AT.getTime() + 1) }),
    );

    await expect(
      strategy.validate(payload({ pwv: CHANGED_AT.getTime() })),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a token without a version once the password has changed', async () => {
    usersServiceMock.findById.mockResolvedValue(
      buildUser({ passwordChangedAt: CHANGED_AT }),
    );

    await expect(
      strategy.validate(payload({ pwv: undefined })),
    ).rejects.toThrow('auth.PASSWORD_CHANGED');
  });

  it('rejects a live token whose account has since been locked', async () => {
    usersServiceMock.findById.mockResolvedValue(
      buildUser({ status: UserStatus.Inactive }),
    );

    await expect(strategy.validate(payload())).rejects.toThrow(
      ForbiddenException,
    );
  });
});
