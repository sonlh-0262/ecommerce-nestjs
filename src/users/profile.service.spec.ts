import {
  ConflictException,
  Logger,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';

import { transactionalDataSource } from '../database/transaction.fixture';

import { buildUser } from './entities/user.fixture';
import { UserTokenType } from './enums/user-token-type.enum';
import { UserPatch } from './interfaces/user-patch.interface';
import { PasswordService } from './password.service';
import { ProfileService } from './profile.service';
import { UserTokensService } from './user-tokens.service';
import { UsersService } from './users.service';

describe('ProfileService', () => {
  const NOW = new Date('2026-10-08T00:00:00.000Z');
  const CURRENT = 'Current123';
  const NEXT = 'BrandNew456';

  let service: ProfileService;

  const usersMock = {
    assertUsernameAvailable: jest.fn(),
    findByIdWithPassword: jest.fn(),
    update: jest.fn(),
  };
  const passwordMock = { compare: jest.fn(), hash: jest.fn() };
  const tokensMock = { retire: jest.fn() };
  const { manager, dataSource } = transactionalDataSource();
  const i18nMock = { t: jest.fn((key: string) => key) };

  const appliedPatch = (): UserPatch => {
    const [[, patch]] = usersMock.update.mock.calls as [[unknown, UserPatch]];

    return patch;
  };

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(NOW);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);

    service = new ProfileService(
      dataSource,
      usersMock as unknown as UsersService,
      passwordMock as unknown as PasswordService,
      tokensMock as unknown as UserTokensService,
      i18nMock as unknown as I18nService,
    );

    usersMock.update.mockImplementation((user: object, patch: object) =>
      Promise.resolve({ ...user, ...patch }),
    );
    usersMock.findByIdWithPassword.mockResolvedValue(
      buildUser({ passwordHash: 'stored-hash' }),
    );
    passwordMock.compare.mockResolvedValue(true);
    passwordMock.hash.mockResolvedValue('new-hash');
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  describe('updateProfile', () => {
    it('writes only the fields that were sent', async () => {
      const user = buildUser();

      await service.updateProfile(user, {
        fullName: 'New Name',
        phone: undefined,
      });

      expect(usersMock.update).toHaveBeenCalledWith(user, {
        fullName: 'New Name',
      });
    });

    it('clears a field sent as null', async () => {
      await service.updateProfile(buildUser(), { address: null });

      expect(appliedPatch()).toEqual({ address: null });
    });

    it('checks a new username is free before writing', async () => {
      await service.updateProfile(buildUser(), { username: 'fresh_name' });

      expect(usersMock.assertUsernameAvailable).toHaveBeenCalledWith(
        'fresh_name',
      );
      expect(
        usersMock.assertUsernameAvailable.mock.invocationCallOrder[0],
      ).toBeLessThan(usersMock.update.mock.invocationCallOrder[0]);
    });

    it('rejects a username another account holds with 409', async () => {
      usersMock.assertUsernameAvailable.mockRejectedValue(
        new ConflictException('users.USERNAME_TAKEN'),
      );

      await expect(
        service.updateProfile(buildUser(), { username: 'taken' }),
      ).rejects.toThrow(ConflictException);
      expect(usersMock.update).not.toHaveBeenCalled();
    });

    it('does not look up the username the account already has', async () => {
      const user = buildUser();

      await service.updateProfile(user, { username: user.username });

      expect(usersMock.assertUsernameAvailable).not.toHaveBeenCalled();
    });

    it('returns the updated account', async () => {
      await expect(
        service.updateProfile(buildUser(), { fullName: 'New Name' }),
      ).resolves.toMatchObject({ fullName: 'New Name' });
    });
  });

  describe('changePassword', () => {
    const change = (currentPassword = CURRENT, newPassword = NEXT) =>
      service.changePassword(buildUser(), { currentPassword, newPassword });

    it('checks the current password against the stored hash', async () => {
      await change();

      expect(passwordMock.compare).toHaveBeenCalledWith(CURRENT, 'stored-hash');
    });

    it('stores the new hash and stamps the change', async () => {
      await change();

      expect(passwordMock.hash).toHaveBeenCalledWith(NEXT);
      expect(appliedPatch()).toEqual({
        passwordHash: 'new-hash',
        passwordChangedAt: NOW,
      });
    });

    it('writes the new hash through the transaction', async () => {
      await change();

      expect(usersMock.update).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        manager,
      );
    });

    it('retires the reset links issued before the change', async () => {
      await change();

      expect(tokensMock.retire).toHaveBeenCalledWith(
        manager,
        buildUser().id,
        UserTokenType.ResetPassword,
      );
    });

    it('rejects a wrong current password with 401', async () => {
      passwordMock.compare.mockResolvedValue(false);

      await expect(change()).rejects.toThrow(
        new UnauthorizedException('users.WRONG_CURRENT_PASSWORD'),
      );
      expect(usersMock.update).not.toHaveBeenCalled();
    });

    it('rejects with 401 when the account has gone', async () => {
      usersMock.findByIdWithPassword.mockResolvedValue(null);

      await expect(change()).rejects.toThrow(UnauthorizedException);
      expect(passwordMock.compare).not.toHaveBeenCalled();
    });

    it('rejects a new password equal to the current one with 422', async () => {
      await expect(change(CURRENT, CURRENT)).rejects.toThrow(
        new UnprocessableEntityException('users.PASSWORD_UNCHANGED'),
      );
      expect(usersMock.update).not.toHaveBeenCalled();
    });

    it('checks the current password before comparing the two', async () => {
      passwordMock.compare.mockResolvedValue(false);

      await expect(change(CURRENT, CURRENT)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
