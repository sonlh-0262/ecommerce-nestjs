import { MailerService } from '@nestjs-modules/mailer';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UnrecoverableError } from 'bullmq';
import { I18nService } from 'nestjs-i18n';

import { MailConfig } from '../config/mail.config';
import { ActionMailJob } from './interfaces/mail-job.interface';
import { MAIL_ACTION_TEMPLATE, MAIL_JOB, MailJobName } from './mail.constants';
import { MailJob, MailProcessor } from './mail.processor';

interface SentMail {
  from: { name: string; address: string };
  to: string;
  subject: string;
  template: string;
  context: Record<string, unknown>;
}

describe('MailProcessor', () => {
  let processor: MailProcessor;
  let logError: jest.SpyInstance;

  const mailerMock = { sendMail: jest.fn() };
  const i18nMock = {
    t: jest.fn(
      (key: string, options: { lang: string; args?: object }) =>
        `${options.lang}:${key}${options.args ? JSON.stringify(options.args) : ''}`,
    ),
  };
  const mailConfig: MailConfig = {
    host: 'localhost',
    port: 1025,
    from: 'no-reply@example.com',
    fromName: 'Ecommerce',
  };

  const payload = (overrides: Partial<ActionMailJob> = {}): ActionMailJob => ({
    to: 'son@example.com',
    lang: 'vi',
    fullName: 'Lanh Hung Son',
    actionUrl: 'https://shop.example.com/verify-email?token=abc',
    expiresInMinutes: 24 * 60,
    ...overrides,
  });

  const jobOf = (name: string, data: ActionMailJob = payload()): MailJob =>
    ({ id: '42', name, data, attemptsMade: 0 }) as unknown as MailJob;

  const sent = (): SentMail => {
    const [[mail]] = mailerMock.sendMail.mock.calls as [[SentMail]];

    return mail;
  };

  beforeEach(() => {
    processor = new MailProcessor(
      mailerMock as unknown as MailerService,
      i18nMock as unknown as I18nService,
      { getOrThrow: () => mailConfig } as unknown as ConfigService,
    );

    mailerMock.sendMail.mockResolvedValue({ messageId: 'id' });
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    logError = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it.each([
    [MAIL_JOB.VerifyEmail, 'mail.VERIFY_EMAIL'],
    [MAIL_JOB.ResetPassword, 'mail.RESET_PASSWORD'],
  ])('renders %s with its own copy', async (name: MailJobName, copy) => {
    await processor.process(jobOf(name));

    expect(sent()).toMatchObject({
      from: { name: 'Ecommerce', address: 'no-reply@example.com' },
      to: 'son@example.com',
      subject: `vi:${copy}.SUBJECT`,
      template: MAIL_ACTION_TEMPLATE,
    });
    expect(sent().context).toMatchObject({
      intro: `vi:${copy}.INTRO`,
      actionLabel: `vi:${copy}.ACTION`,
      expiry: `vi:${copy}.EXPIRY{"duration":"24 giờ"}`,
    });
  });

  it('puts the link, the language and a greeting by name in the context', async () => {
    await processor.process(jobOf(MAIL_JOB.VerifyEmail));

    expect(sent().context).toMatchObject({
      actionUrl: 'https://shop.example.com/verify-email?token=abc',
      greeting: 'vi:mail.GREETING{"name":"Lanh Hung Son"}',
      lang: 'vi',
      appName: 'Ecommerce',
    });
  });

  it('words a lifetime under an hour in minutes', async () => {
    await processor.process(
      jobOf(
        MAIL_JOB.ResetPassword,
        payload({ lang: 'en', expiresInMinutes: 30 }),
      ),
    );

    expect(sent().context.expiry).toBe(
      'en:mail.RESET_PASSWORD.EXPIRY{"duration":"30 minutes"}',
    );
  });

  it('greets an account without a name by its email', async () => {
    await processor.process(
      jobOf(MAIL_JOB.ResetPassword, payload({ fullName: '  ', lang: 'en' })),
    );

    expect(sent().context.greeting).toBe(
      'en:mail.GREETING{"name":"son@example.com"}',
    );
  });

  it('falls back to Vietnamese for a language without a catalogue', async () => {
    await processor.process(
      jobOf(
        MAIL_JOB.VerifyEmail,
        payload({ lang: 'fr' as ActionMailJob['lang'] }),
      ),
    );

    expect(sent().subject).toBe('vi:mail.VERIFY_EMAIL.SUBJECT');
  });

  it('rethrows a delivery failure so BullMQ retries the job', async () => {
    mailerMock.sendMail.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(
      processor.process(jobOf(MAIL_JOB.VerifyEmail)),
    ).rejects.toThrow('ECONNREFUSED');
    expect(logError).toHaveBeenCalled();
  });

  it('refuses a job name it does not know without retrying', async () => {
    await expect(processor.process(jobOf('send-unknown'))).rejects.toThrow(
      UnrecoverableError,
    );
    expect(mailerMock.sendMail).not.toHaveBeenCalled();
  });
});
