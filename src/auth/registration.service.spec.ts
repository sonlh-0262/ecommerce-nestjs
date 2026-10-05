import {
  ConflictException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { transactionalDataSource } from '../database/transaction.fixture';
import { buildUser } from '../users/entities/user.fixture';
import { UserStatus } from '../users/enums/user-status.enum';
import { UserTokenType } from '../users/enums/user-token-type.enum';
import { PasswordService } from '../users/password.service';
import { UserTokensService } from '../users/user-tokens.service';
import { UsersService } from '../users/users.service';
import { AccountLinksService } from './account-links.service';
import { RegistrationService } from './registration.service';

describe('RegistrationService', () => {
  const TOKEN = 'a'.repeat(64);
  const HASH = 'hashed-password';
  const input = {
    email: 'new.user@example.com',
    username: 'new_user',
    password: 'Secret123',
    fullName: 'New User',
  };

  let service: RegistrationService;

  const { manager, transaction, dataSource } = transactionalDataSource();
  const usersMock = {
    assertAvailable: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    findByEmail: jest.fn(),
  };
  const passwordMock = { hash: jest.fn() };
  const tokensMock = { issue: jest.fn(), consume: jest.fn() };
  const linksMock = { send: jest.fn(), issueAndSend: jest.fn() };

  beforeEach(() => {
    service = new RegistrationService(
      dataSource,
      usersMock as unknown as UsersService,
      passwordMock as unknown as PasswordService,
      tokensMock as unknown as UserTokensService,
      linksMock as unknown as AccountLinksService,
    );

    passwordMock.hash.mockResolvedValue(HASH);
    tokensMock.issue.mockResolvedValue(TOKEN);
    usersMock.update.mockImplementation((user: object, patch: object) =>
      Promise.resolve({ ...user, ...patch }),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    const pending = buildUser({
      status: UserStatus.Pending,
      emailVerifiedAt: null,
    });

    beforeEach(() => {
      usersMock.create.mockResolvedValue(pending);
    });

    it('creates the account and its token in one transaction', async () => {
      await expect(service.register(input)).resolves.toBe(pending);

      expect(usersMock.create).toHaveBeenCalledWith(
        {
          email: input.email,
          username: input.username,
          fullName: input.fullName,
          passwordHash: HASH,
        },
        manager,
      );
      expect(tokensMock.issue).toHaveBeenCalledWith(
        manager,
        pending.id,
        UserTokenType.EmailVerify,
      );
    });

    it('never stores the plaintext password', async () => {
      await service.register(input);

      expect(JSON.stringify(usersMock.create.mock.calls)).not.toContain(
        input.password,
      );
    });

    it('stores a missing full name as null', async () => {
      await service.register({ ...input, fullName: undefined });

      expect(usersMock.create).toHaveBeenCalledWith(
        expect.objectContaining({ fullName: null }),
        manager,
      );
    });

    it('emails the activation link only after the transaction', async () => {
      await service.register(input);

      expect(linksMock.send).toHaveBeenCalledWith(
        pending,
        UserTokenType.EmailVerify,
        TOKEN,
      );
      expect(transaction.mock.invocationCallOrder[0]).toBeLessThan(
        linksMock.send.mock.invocationCallOrder[0],
      );
    });

    it('stops before hashing when the email or username is taken', async () => {
      usersMock.assertAvailable.mockRejectedValue(
        new ConflictException('users.EMAIL_TAKEN'),
      );

      await expect(service.register(input)).rejects.toThrow(ConflictException);
      expect(passwordMock.hash).not.toHaveBeenCalled();
      expect(usersMock.create).not.toHaveBeenCalled();
    });

    it('sends no mail when the insert loses a race', async () => {
      usersMock.create.mockRejectedValue(
        new ConflictException('users.USERNAME_TAKEN'),
      );

      await expect(service.register(input)).rejects.toThrow(ConflictException);
      expect(linksMock.send).not.toHaveBeenCalled();
    });
  });

  describe('verifyEmail', () => {
    it('redeems the token and activates the account', async () => {
      const pending = buildUser({
        status: UserStatus.Pending,
        emailVerifiedAt: null,
      });
      tokensMock.consume.mockResolvedValue(pending);

      const user = await service.verifyEmail(TOKEN);

      expect(tokensMock.consume).toHaveBeenCalledWith(
        manager,
        TOKEN,
        UserTokenType.EmailVerify,
      );
      expect(user.status).toBe(UserStatus.Active);
      expect(user.emailVerifiedAt).toBeInstanceOf(Date);
    });

    it('leaves an already active account as it is', async () => {
      const active = buildUser();
      tokensMock.consume.mockResolvedValue(active);

      await service.verifyEmail(TOKEN);

      expect(usersMock.update).toHaveBeenCalledWith(active, {}, manager);
    });

    it('passes on the rejection of a bad token', async () => {
      tokensMock.consume.mockRejectedValue(
        new UnprocessableEntityException('auth.INVALID_TOKEN'),
      );

      await expect(service.verifyEmail(TOKEN)).rejects.toThrow(
        UnprocessableEntityException,
      );
      expect(usersMock.update).not.toHaveBeenCalled();
    });
  });

  describe('resendVerification', () => {
    it('issues and emails a new link to a pending account', async () => {
      const pending = buildUser({
        status: UserStatus.Pending,
        emailVerifiedAt: null,
      });
      usersMock.findByEmail.mockResolvedValue(pending);

      await service.resendVerification(pending.email);

      expect(linksMock.issueAndSend).toHaveBeenCalledWith(
        pending,
        UserTokenType.EmailVerify,
      );
    });

    it.each([
      ['an unknown email', null],
      ['an active account', buildUser()],
      ['a locked account', buildUser({ status: UserStatus.Inactive })],
    ])('does nothing for %s', async (_case, user) => {
      usersMock.findByEmail.mockResolvedValue(user);

      await expect(
        service.resendVerification('son@example.com'),
      ).resolves.toBeUndefined();
      expect(linksMock.issueAndSend).not.toHaveBeenCalled();
    });
  });
});
