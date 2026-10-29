import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { I18nService } from 'nestjs-i18n';

import { buildUser } from '../users/entities/user.fixture';
import { UserStatus } from '../users/enums/user-status.enum';
import { PasswordService } from '../users/password.service';
import { UsersService } from '../users/users.service';
import { DUMMY_PASSWORD_HASH } from './auth.constants';
import { AuthService } from './auth.service';
import { JwtPayloadClaims } from './interfaces/jwt-payload.interface';
import { JwtStrategy } from './strategies/jwt.strategy';
import { TokenBlacklistService } from './token-blacklist.service';

describe('AuthService', () => {
  const PASSWORD = 'Password@123';
  const TOKEN = 'signed.jwt.token';
  const ISSUED_AT = 1_790_000_000;
  const EXPIRES_AT = ISSUED_AT + 86_400;

  let authService: AuthService;

  const usersServiceMock = { findByEmailWithPassword: jest.fn() };
  const passwordServiceMock = { compare: jest.fn() };
  const tokenBlacklistMock = { revoke: jest.fn() };
  const jwtServiceMock = {
    sign: jest.fn(() => TOKEN),
    decode: jest.fn(() => ({ iat: ISSUED_AT, exp: EXPIRES_AT })),
    verifyAsync: jest.fn(),
  };
  const jwtStrategyMock = { validate: jest.fn() };
  const i18nServiceMock = { t: jest.fn((key: string) => key) };

  /**
   * The arguments `JwtService.sign` was called with.
   *
   * Recovered from the mock and typed here rather than matched with
   * `expect.any`, which is untyped and would have the assertion smuggle `any`
   * back into a strict file.
   */
  const signCalls = (): [JwtPayloadClaims, { jwtid: string }][] =>
    jwtServiceMock.sign.mock.calls as unknown as [
      JwtPayloadClaims,
      { jwtid: string },
    ][];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersServiceMock },
        { provide: PasswordService, useValue: passwordServiceMock },
        { provide: JwtService, useValue: jwtServiceMock },
        { provide: TokenBlacklistService, useValue: tokenBlacklistMock },
        { provide: JwtStrategy, useValue: jwtStrategyMock },
        { provide: I18nService, useValue: i18nServiceMock },
      ],
    }).compile();

    authService = module.get(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('returns the account and a session for the right password', async () => {
      usersServiceMock.findByEmailWithPassword.mockResolvedValue(buildUser());
      passwordServiceMock.compare.mockResolvedValue(true);

      const result = await authService.login({
        email: 'son@example.com',
        password: PASSWORD,
      });

      expect(result.user.username).toBe('sonlh');
      expect(result.session).toEqual({
        token: TOKEN,
        expiresIn: EXPIRES_AT - ISSUED_AT,
      });
    });

    it('does not leak the password hash to the caller', async () => {
      usersServiceMock.findByEmailWithPassword.mockResolvedValue(buildUser());
      passwordServiceMock.compare.mockResolvedValue(true);

      const { user } = await authService.login({
        email: 'son@example.com',
        password: PASSWORD,
      });

      expect(user.passwordHash).toBeUndefined();
    });

    it('rejects a wrong password with 401', async () => {
      usersServiceMock.findByEmailWithPassword.mockResolvedValue(buildUser());
      passwordServiceMock.compare.mockResolvedValue(false);

      await expect(
        authService.login({ email: 'son@example.com', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects an unknown email with 401', async () => {
      usersServiceMock.findByEmailWithPassword.mockResolvedValue(null);
      passwordServiceMock.compare.mockResolvedValue(false);

      await expect(
        authService.login({ email: 'nobody@example.com', password: PASSWORD }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('still hashes against a dummy when the email is unknown', async () => {
      // Without this, a missing account answers measurably faster than a wrong
      // password and the endpoint becomes an email oracle.
      usersServiceMock.findByEmailWithPassword.mockResolvedValue(null);
      passwordServiceMock.compare.mockResolvedValue(false);

      await expect(
        authService.login({ email: 'nobody@example.com', password: PASSWORD }),
      ).rejects.toThrow(UnauthorizedException);

      expect(passwordServiceMock.compare).toHaveBeenCalledWith(
        PASSWORD,
        DUMMY_PASSWORD_HASH,
      );
    });

    it('gives the same message for a wrong password and an unknown email', async () => {
      usersServiceMock.findByEmailWithPassword.mockResolvedValue(null);
      passwordServiceMock.compare.mockResolvedValue(false);

      await expect(
        authService.login({ email: 'nobody@example.com', password: PASSWORD }),
      ).rejects.toThrow('auth.INVALID_CREDENTIALS');

      usersServiceMock.findByEmailWithPassword.mockResolvedValue(buildUser());

      await expect(
        authService.login({ email: 'son@example.com', password: 'wrong' }),
      ).rejects.toThrow('auth.INVALID_CREDENTIALS');
    });

    it('rejects an unverified account with 403', async () => {
      usersServiceMock.findByEmailWithPassword.mockResolvedValue(
        buildUser({ status: UserStatus.Pending, emailVerifiedAt: null }),
      );
      passwordServiceMock.compare.mockResolvedValue(true);

      await expect(
        authService.login({ email: 'son@example.com', password: PASSWORD }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects a locked account with 403', async () => {
      usersServiceMock.findByEmailWithPassword.mockResolvedValue(
        buildUser({ status: UserStatus.Inactive }),
      );
      passwordServiceMock.compare.mockResolvedValue(true);

      await expect(
        authService.login({ email: 'son@example.com', password: PASSWORD }),
      ).rejects.toThrow('auth.ACCOUNT_INACTIVE');
    });

    it('checks the password before the status', async () => {
      // A locked account must answer "wrong credentials" to a wrong password,
      // or its status can be probed without knowing the password.
      usersServiceMock.findByEmailWithPassword.mockResolvedValue(
        buildUser({ status: UserStatus.Inactive }),
      );
      passwordServiceMock.compare.mockResolvedValue(false);

      await expect(
        authService.login({ email: 'son@example.com', password: 'wrong' }),
      ).rejects.toThrow('auth.INVALID_CREDENTIALS');
    });

    it('issues the token with a unique id so it can be revoked', async () => {
      const seeded = buildUser();
      usersServiceMock.findByEmailWithPassword.mockResolvedValue(seeded);
      passwordServiceMock.compare.mockResolvedValue(true);

      await authService.login({
        email: 'son@example.com',
        password: PASSWORD,
      });

      const [claims, options] = signCalls()[0];

      expect(claims).toEqual({
        sub: seeded.id,
        email: seeded.email,
        username: seeded.username,
        pwv: null,
      });
      // A `jti` per token is what makes one session revocable on its own; a
      // uuid is 36 characters.
      expect(options.jwtid).toHaveLength(36);
    });
  });

  it('stamps the token with the current password version', () => {
    const changedAt = new Date('2026-10-05T00:00:00.500Z');

    authService.issueSession(buildUser({ passwordChangedAt: changedAt }));

    expect(signCalls()[0][0].pwv).toBe(changedAt.getTime());
  });

  describe('authenticate', () => {
    it('verifies the token, then runs the same checks as an HTTP request', async () => {
      const payload = { sub: 'user-id', jti: 'token-id', exp: EXPIRES_AT };
      const authenticated = { user: buildUser(), jti: 'token-id' };

      jwtServiceMock.verifyAsync.mockResolvedValue(payload);
      jwtStrategyMock.validate.mockResolvedValue(authenticated);

      await expect(authService.authenticate(TOKEN)).resolves.toBe(
        authenticated,
      );
      expect(jwtServiceMock.verifyAsync).toHaveBeenCalledWith(TOKEN);
      expect(jwtStrategyMock.validate).toHaveBeenCalledWith(payload);
    });

    it('answers a forged or expired token with 401', async () => {
      jwtServiceMock.verifyAsync.mockRejectedValue(new Error('jwt expired'));

      await expect(authService.authenticate(TOKEN)).rejects.toThrow(
        new UnauthorizedException('auth.UNAUTHORIZED'),
      );
      expect(jwtStrategyMock.validate).not.toHaveBeenCalled();
    });

    it.each([undefined, 42, { token: TOKEN }])(
      'answers a missing token (%p) with 401 without verifying it',
      async (token) => {
        await expect(authService.authenticate(token)).rejects.toThrow(
          UnauthorizedException,
        );
        expect(jwtServiceMock.verifyAsync).not.toHaveBeenCalled();
      },
    );

    it('keeps the status of a rejection raised by the strategy', async () => {
      const locked = new ForbiddenException('auth.ACCOUNT_INACTIVE');

      jwtServiceMock.verifyAsync.mockResolvedValue({ sub: 'user-id' });
      jwtStrategyMock.validate.mockRejectedValue(locked);

      await expect(authService.authenticate(TOKEN)).rejects.toBe(locked);
    });
  });

  describe('logout', () => {
    it('revokes the token and reports it', async () => {
      tokenBlacklistMock.revoke.mockResolvedValue(true);

      await expect(authService.logout('jti-1', EXPIRES_AT)).resolves.toBe(true);
      expect(tokenBlacklistMock.revoke).toHaveBeenCalledWith(
        'jti-1',
        EXPIRES_AT,
      );
    });

    it('reports false for a token that had already expired', async () => {
      tokenBlacklistMock.revoke.mockResolvedValue(false);

      await expect(authService.logout('jti-1', 1)).resolves.toBe(false);
    });
  });
});
