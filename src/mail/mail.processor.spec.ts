import { MailerService } from '@nestjs-modules/mailer';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UnrecoverableError } from 'bullmq';
import { I18nService } from 'nestjs-i18n';

import { MailConfig } from '../config/mail.config';
import { OrderStatus } from '../orders/enums/order-status.enum';
import {
  ActionMailJob,
  OrderCreatedMailJob,
  OrderStatusChangedMailJob,
} from './interfaces/mail-job.interface';
import {
  MAIL_ACTION_TEMPLATE,
  MAIL_JOB,
  MAIL_ORDER_CREATED_TEMPLATE,
  MAIL_ORDER_STATUS_CHANGED_TEMPLATE,
  MailJobName,
} from './mail.constants';
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

  describe(MAIL_JOB.OrderCreated, () => {
    const order = (lang: OrderCreatedMailJob['lang']): OrderCreatedMailJob => ({
      to: 'son@example.com',
      lang,
      fullName: 'Lanh Hung Son',
      orderCode: 'ORD-20261005-0001',
      items: [{ name: 'Áo thun', quantity: 2, lineTotal: 300000 }],
      subtotal: 300000,
      shippingFee: 30000,
      total: 330000,
      shippingAddress: '1 Nguyen Trai, Ha Noi',
    });

    const orderJob = (lang: OrderCreatedMailJob['lang']) =>
      ({
        id: '43',
        name: MAIL_JOB.OrderCreated,
        data: order(lang),
        attemptsMade: 0,
      }) as unknown as MailJob;

    it('renders the order template with the code in the subject', async () => {
      await processor.process(orderJob('vi'));

      expect(sent()).toMatchObject({
        to: 'son@example.com',
        subject: 'vi:mail.ORDER_CREATED.SUBJECT{"code":"ORD-20261005-0001"}',
        template: MAIL_ORDER_CREATED_TEMPLATE,
      });
      expect(sent().context).toMatchObject({
        greeting: 'vi:mail.GREETING{"name":"Lanh Hung Son"}',
        intro: 'vi:mail.ORDER_CREATED.INTRO{"code":"ORD-20261005-0001"}',
        shippingAddress: '1 Nguyen Trai, Ha Noi',
        labels: {
          product: 'vi:mail.ORDER_CREATED.PRODUCT',
          total: 'vi:mail.ORDER_CREATED.TOTAL',
        },
      });
    });

    it('writes every amount in VND for the reader', async () => {
      await processor.process(orderJob('vi'));

      const context = JSON.parse(
        JSON.stringify(sent().context).replace(/\u00a0/g, ' '),
      ) as Record<string, unknown>;

      expect(context).toMatchObject({
        items: [{ name: 'Áo thun', quantity: 2, lineTotal: '300.000 ₫' }],
        subtotal: '300.000 ₫',
        shippingFee: '30.000 ₫',
        total: '330.000 ₫',
      });
    });

    it('formats the amounts the English way for an English reader', async () => {
      await processor.process(orderJob('en'));

      expect(sent().context.total).toBe('₫330,000');
    });
  });

  describe(MAIL_JOB.OrderStatusChanged, () => {
    const statusJob = (data: Partial<OrderStatusChangedMailJob>) =>
      ({
        id: '44',
        name: MAIL_JOB.OrderStatusChanged,
        data: {
          to: 'son@example.com',
          lang: 'vi',
          fullName: 'Lanh Hung Son',
          orderCode: 'ORD-20261005-0001',
          status: OrderStatus.Confirmed,
          reason: null,
          ...data,
        },
        attemptsMade: 0,
      }) as unknown as MailJob;

    it.each([OrderStatus.Confirmed, OrderStatus.Rejected])(
      'words a %s order with its own copy',
      async (status) => {
        await processor.process(statusJob({ status }));

        expect(sent()).toMatchObject({
          subject: `vi:mail.ORDER_STATUS_CHANGED.${status}.SUBJECT{"code":"ORD-20261005-0001"}`,
          template: MAIL_ORDER_STATUS_CHANGED_TEMPLATE,
        });
        expect(sent().context).toMatchObject({
          greeting: 'vi:mail.GREETING{"name":"Lanh Hung Son"}',
          intro: `vi:mail.ORDER_STATUS_CHANGED.${status}.INTRO{"code":"ORD-20261005-0001"}`,
        });
      },
    );

    it('carries the reason of a rejection with its label', async () => {
      await processor.process(
        statusJob({
          status: OrderStatus.Rejected,
          reason: 'Outside our delivery area',
        }),
      );

      expect(sent().context).toMatchObject({
        reasonLabel: 'vi:mail.ORDER_STATUS_CHANGED.REASON',
        reason: 'Outside our delivery area',
      });
    });
  });

  it('refuses a job name it does not know without retrying', async () => {
    await expect(processor.process(jobOf('send-unknown'))).rejects.toThrow(
      UnrecoverableError,
    );
    expect(mailerMock.sendMail).not.toHaveBeenCalled();
  });
});
