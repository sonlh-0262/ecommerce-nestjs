import { Logger, UnprocessableEntityException } from '@nestjs/common';

import { transactionalDataSource } from '../database/transaction.fixture';
import { buildUser } from '../users/entities/user.fixture';
import { UserStatus } from '../users/enums/user-status.enum';
import { UserTokenType } from '../users/enums/user-token-type.enum';
import { UserPatch } from '../users/interfaces/user-patch.interface';
import { PasswordService } from '../users/password.service';
import { UserTokensService } from '../users/user-tokens.service';
import { UsersService } from '../users/users.service';
import { AccountLinksService } from './account-links.service';
import { PasswordResetService } from './password-reset.service';

describe('PasswordResetService', () => {
  const TOKEN = 'b'.repeat(64);
  const NEW_PASSWORD = 'BrandNew456';
  const NEW_HASH = 'new-hash';
  const NOW = new Date('2026-10-05T00:00:00.000Z');

  let service: PasswordResetService;

  const { manager, dataSource } = transactionalDataSource();
  const usersMock = { findByEmail: jest.fn(), update: jest.fn() };
  const passwordMock = { hash: jest.fn() };
  const tokensMock = { consume: jest.fn() };
  const linksMock = { issueAndSend: jest.fn() };

  const appliedPatch = (): UserPatch => {
    const [[, patch]] = usersMock.update.mock.calls as [[unknown, UserPatch]];

    return patch;
  };

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(NOW);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);

    service = new PasswordResetService(
      dataSource,
      usersMock as unknown as UsersService,
      passwordMock as unknown as PasswordService,
      tokensMock as unknown as UserTokensService,
      linksMock as unknown as AccountLinksService,
    );

    passwordMock.hash.mockResolvedValue(NEW_HASH);
    usersMock.update.mockImplementation((user: object, patch: object) =>
      Promise.resolve({ ...user, ...patch }),
    );
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  describe('forgotPassword', () => {
    it('emails a reset link to a registered account', async () => {
      const user = buildUser();
      usersMock.findByEmail.mockResolvedValue(user);

      await service.forgotPassword(user.email);

      expect(linksMock.issueAndSend).toHaveBeenCalledWith(
        user,
        UserTokenType.ResetPassword,
      );
    });

    it('resolves without sending anything for an unknown email', async () => {
      usersMock.findByEmail.mockResolvedValue(null);

      await expect(
        service.forgotPassword('nobody@example.com'),
      ).resolves.toBeUndefined();
      expect(linksMock.issueAndSend).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('stores the new hash and stamps the change', async () => {
      const user = buildUser();
      tokensMock.consume.mockResolvedValue(user);

      await service.resetPassword(TOKEN, NEW_PASSWORD);

      expect(passwordMock.hash).toHaveBeenCalledWith(NEW_PASSWORD);
      expect(tokensMock.consume).toHaveBeenCalledWith(
        manager,
        TOKEN,
        UserTokenType.ResetPassword,
      );
      expect(appliedPatch()).toEqual({
        passwordHash: NEW_HASH,
        passwordChangedAt: NOW,
      });
    });

    it('activates a pending account in the same write', async () => {
      tokensMock.consume.mockResolvedValue(
        buildUser({ status: UserStatus.Pending, emailVerifiedAt: null }),
      );

      await service.resetPassword(TOKEN, NEW_PASSWORD);

      expect(appliedPatch()).toEqual({
        status: UserStatus.Active,
        emailVerifiedAt: NOW,
        passwordHash: NEW_HASH,
        passwordChangedAt: NOW,
      });
    });

    it('keeps a locked account locked', async () => {
      tokensMock.consume.mockResolvedValue(
        buildUser({ status: UserStatus.Inactive }),
      );

      await service.resetPassword(TOKEN, NEW_PASSWORD);

      expect(appliedPatch()).not.toHaveProperty('status');
    });

    it('changes nothing for a bad token', async () => {
      tokensMock.consume.mockRejectedValue(
        new UnprocessableEntityException('auth.INVALID_TOKEN'),
      );

      await expect(service.resetPassword(TOKEN, NEW_PASSWORD)).rejects.toThrow(
        UnprocessableEntityException,
      );
      expect(usersMock.update).not.toHaveBeenCalled();
    });
  });
});
