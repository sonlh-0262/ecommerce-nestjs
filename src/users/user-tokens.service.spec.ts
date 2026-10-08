import { UnprocessableEntityException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { EntityManager, IsNull } from 'typeorm';

import { MILLISECONDS_PER_MINUTE } from '../common/constants/time';
import { UserToken } from './entities/user-token.entity';
import { buildUser } from './entities/user.fixture';
import { User } from './entities/user.entity';
import { UserTokenType } from './enums/user-token-type.enum';
import { hashToken, UserTokensService } from './user-tokens.service';
import { USER_TOKEN_PATTERN, USER_TOKEN_TTL_MINUTES } from './users.constants';

describe('UserTokensService', () => {
  const NOW = new Date('2026-10-05T00:00:00.000Z');
  const USER_ID = buildUser().id;

  let service: UserTokensService;

  const queryBuilder = {
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    returning: jest.fn().mockReturnThis(),
    execute: jest.fn(),
  };
  const managerMock = {
    update: jest.fn(),
    insert: jest.fn(),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(() => queryBuilder),
  };
  const manager = managerMock as unknown as EntityManager;
  const i18nMock = { t: jest.fn((key: string) => key) };

  const inserted = (): Partial<UserToken> => {
    const [[, row]] = managerMock.insert.mock.calls as [
      [unknown, Partial<UserToken>],
    ];

    return row;
  };

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(NOW);
    service = new UserTokensService(i18nMock as unknown as I18nService);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  describe('issue', () => {
    it('returns a 64 character hex token', async () => {
      const token = await service.issue(
        manager,
        USER_ID,
        UserTokenType.EmailVerify,
      );

      expect(token).toMatch(USER_TOKEN_PATTERN);
    });

    it('stores the SHA-256 of the token, never the token itself', async () => {
      const token = await service.issue(
        manager,
        USER_ID,
        UserTokenType.EmailVerify,
      );

      expect(inserted().tokenHash).toBe(hashToken(token));
      expect(inserted().tokenHash).not.toBe(token);
    });

    it.each([UserTokenType.EmailVerify, UserTokenType.ResetPassword])(
      'gives a %s token its own lifetime',
      async (type) => {
        await service.issue(manager, USER_ID, type);

        expect(inserted()).toMatchObject({
          userId: USER_ID,
          type,
          expiresAt: new Date(
            NOW.getTime() +
              USER_TOKEN_TTL_MINUTES[type] * MILLISECONDS_PER_MINUTE,
          ),
        });
      },
    );

    it('locks the account row before touching its tokens', async () => {
      await service.issue(manager, USER_ID, UserTokenType.EmailVerify);

      expect(managerMock.findOne).toHaveBeenCalledWith(User, {
        where: { id: USER_ID },
        lock: { mode: 'pessimistic_write' },
      });
      expect(managerMock.findOne.mock.invocationCallOrder[0]).toBeLessThan(
        managerMock.update.mock.invocationCallOrder[0],
      );
    });

    it('retires the live tokens of the same type first', async () => {
      await service.issue(manager, USER_ID, UserTokenType.ResetPassword);

      const [[entity, criteria]] = managerMock.update.mock.calls as [
        [unknown, Record<string, unknown>],
      ];

      expect(entity).toBe(UserToken);
      expect(criteria).toEqual({
        userId: USER_ID,
        type: UserTokenType.ResetPassword,
        usedAt: IsNull(),
      });
      expect(managerMock.update.mock.invocationCallOrder[0]).toBeLessThan(
        managerMock.insert.mock.invocationCallOrder[0],
      );
    });

    it('never hands out the same token twice', async () => {
      const first = await service.issue(
        manager,
        USER_ID,
        UserTokenType.EmailVerify,
      );
      const second = await service.issue(
        manager,
        USER_ID,
        UserTokenType.EmailVerify,
      );

      expect(first).not.toBe(second);
    });
  });

  describe('retire', () => {
    it('marks every live token of the type used', async () => {
      await service.retire(manager, USER_ID, UserTokenType.ResetPassword);

      expect(managerMock.update).toHaveBeenCalledWith(
        UserToken,
        {
          userId: USER_ID,
          type: UserTokenType.ResetPassword,
          usedAt: IsNull(),
        },
        { usedAt: expect.any(Function) as unknown },
      );
    });
  });

  describe('consume', () => {
    const TOKEN = 'a'.repeat(64);

    it('marks the token used and returns its account', async () => {
      const user = buildUser();
      queryBuilder.execute.mockResolvedValue({ raw: [{ user_id: user.id }] });
      managerMock.findOne.mockResolvedValue(user);

      await expect(
        service.consume(manager, TOKEN, UserTokenType.EmailVerify),
      ).resolves.toBe(user);
      expect(queryBuilder.where).toHaveBeenCalledWith(
        'token_hash = :tokenHash',
        { tokenHash: hashToken(TOKEN) },
      );
      expect(managerMock.findOne).toHaveBeenCalledWith(User, {
        where: { id: user.id },
      });
    });

    it('only matches a live token of the requested type', async () => {
      queryBuilder.execute.mockResolvedValue({ raw: [{ user_id: USER_ID }] });
      managerMock.findOne.mockResolvedValue(buildUser());

      await service.consume(manager, TOKEN, UserTokenType.ResetPassword);

      expect(queryBuilder.andWhere).toHaveBeenCalledWith('type = :type', {
        type: UserTokenType.ResetPassword,
      });
      expect(queryBuilder.andWhere).toHaveBeenCalledWith('used_at IS NULL');
      expect(queryBuilder.andWhere).toHaveBeenCalledWith('expires_at > now()');
    });

    it('rejects a token that is unknown, used or expired with 422', async () => {
      queryBuilder.execute.mockResolvedValue({ raw: [] });

      await expect(
        service.consume(manager, TOKEN, UserTokenType.EmailVerify),
      ).rejects.toThrow(UnprocessableEntityException);
      expect(managerMock.findOne).not.toHaveBeenCalled();
    });

    it('rejects a token whose account has since been deleted', async () => {
      queryBuilder.execute.mockResolvedValue({ raw: [{ user_id: USER_ID }] });
      managerMock.findOne.mockResolvedValue(null);

      await expect(
        service.consume(manager, TOKEN, UserTokenType.EmailVerify),
      ).rejects.toThrow('auth.INVALID_TOKEN');
    });
  });
});
