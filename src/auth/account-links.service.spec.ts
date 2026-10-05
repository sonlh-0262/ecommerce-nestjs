import { ConfigService } from '@nestjs/config';

import { AppConfig } from '../config/configuration';
import { MAIL_JOB } from '../mail/mail.constants';
import { MailQueueService } from '../mail/mail-queue.service';
import { transactionalDataSource } from '../database/transaction.fixture';
import { buildUser } from '../users/entities/user.fixture';
import { UserTokenType } from '../users/enums/user-token-type.enum';
import { UserTokensService } from '../users/user-tokens.service';
import { USER_TOKEN_TTL_MINUTES } from '../users/users.constants';
import { AccountLinksService } from './account-links.service';

describe('AccountLinksService', () => {
  const WEB_URL = 'https://shop.example.com';
  const TOKEN = 'c'.repeat(64);

  let service: AccountLinksService;

  const { manager, dataSource } = transactionalDataSource();
  const tokensMock = { issue: jest.fn() };
  const mailQueueMock = { enqueue: jest.fn() };
  const configMock = {
    getOrThrow: () => ({ webUrl: WEB_URL }) as AppConfig,
  };

  beforeEach(() => {
    service = new AccountLinksService(
      dataSource,
      tokensMock as unknown as UserTokensService,
      mailQueueMock as unknown as MailQueueService,
      configMock as unknown as ConfigService,
    );

    tokensMock.issue.mockResolvedValue(TOKEN);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('send', () => {
    it.each([
      [UserTokenType.EmailVerify, MAIL_JOB.VerifyEmail, '/verify-email'],
      [UserTokenType.ResetPassword, MAIL_JOB.ResetPassword, '/reset-password'],
    ])('mails a %s link to the web app', async (type, job, path) => {
      const user = buildUser();

      await service.send(user, type, TOKEN);

      expect(mailQueueMock.enqueue).toHaveBeenCalledWith(job, {
        to: user.email,
        fullName: user.fullName,
        expiresInMinutes: USER_TOKEN_TTL_MINUTES[type],
        actionUrl: `${WEB_URL}${path}?token=${TOKEN}`,
      });
    });
  });

  describe('issueAndSend', () => {
    it('issues the token in a transaction, then mails it', async () => {
      const user = buildUser();

      await service.issueAndSend(user, UserTokenType.ResetPassword);

      expect(tokensMock.issue).toHaveBeenCalledWith(
        manager,
        user.id,
        UserTokenType.ResetPassword,
      );
      expect(mailQueueMock.enqueue).toHaveBeenCalledWith(
        MAIL_JOB.ResetPassword,
        expect.objectContaining({
          actionUrl: `${WEB_URL}/reset-password?token=${TOKEN}`,
        }),
      );
    });

    it('mails nothing when the token cannot be stored', async () => {
      tokensMock.issue.mockRejectedValue(new Error('connection lost'));

      await expect(
        service.issueAndSend(buildUser(), UserTokenType.EmailVerify),
      ).rejects.toThrow('connection lost');
      expect(mailQueueMock.enqueue).not.toHaveBeenCalled();
    });
  });
});
