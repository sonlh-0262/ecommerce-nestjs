import { Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { I18nContext } from 'nestjs-i18n';

import { MAIL_ENQUEUE_TIMEOUT_MS, MAIL_JOB } from './mail.constants';
import { MailQueueService } from './mail-queue.service';

describe('MailQueueService', () => {
  let service: MailQueueService;
  let logError: jest.SpyInstance;

  const queueMock = { add: jest.fn() };
  const input = {
    to: 'son@example.com',
    fullName: 'Lanh Hung Son',
    actionUrl: 'https://shop.example.com/verify-email?token=abc',
    expiresInMinutes: 30,
  };

  const queued = () => {
    const [[name, data]] = queueMock.add.mock.calls as [
      [string, Record<string, unknown>],
    ];

    return { name, data };
  };

  beforeEach(() => {
    service = new MailQueueService(queueMock as unknown as Queue);
    queueMock.add.mockResolvedValue({ id: '1' });
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    logError = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('queues the job under its name with the payload', async () => {
    jest
      .spyOn(I18nContext, 'current')
      .mockReturnValue({ lang: 'en' } as I18nContext);

    await service.enqueue(MAIL_JOB.VerifyEmail, input);

    expect(queued()).toEqual({
      name: MAIL_JOB.VerifyEmail,
      data: { ...input, lang: 'en' },
    });
  });

  it('captures the language of the current request', async () => {
    jest
      .spyOn(I18nContext, 'current')
      .mockReturnValue({ lang: 'en-GB' } as I18nContext);

    await service.enqueue(MAIL_JOB.ResetPassword, input);

    expect(queued().data.lang).toBe('en');
  });

  it('falls back to Vietnamese outside a request', async () => {
    jest.spyOn(I18nContext, 'current').mockReturnValue(undefined);

    await service.enqueue(MAIL_JOB.VerifyEmail, input);

    expect(queued().data.lang).toBe('vi');
  });

  it('logs instead of failing the caller when the queue rejects', async () => {
    queueMock.add.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(
      service.enqueue(MAIL_JOB.VerifyEmail, input),
    ).resolves.toBeUndefined();
    expect(logError).toHaveBeenCalledWith(
      `Could not queue ${MAIL_JOB.VerifyEmail}: ECONNREFUSED`,
    );
  });

  it('gives up on a queue that never answers', async () => {
    jest.useFakeTimers();
    queueMock.add.mockReturnValue(new Promise(() => undefined));

    const pending = service.enqueue(MAIL_JOB.VerifyEmail, input);
    await jest.advanceTimersByTimeAsync(MAIL_ENQUEUE_TIMEOUT_MS);

    await expect(pending).resolves.toBeUndefined();
    expect(logError).toHaveBeenCalled();
  });

  it('never writes the link into the log', async () => {
    queueMock.add.mockRejectedValue(new Error('down'));

    await service.enqueue(MAIL_JOB.VerifyEmail, input);

    expect(JSON.stringify(logError.mock.calls)).not.toContain('token=abc');
  });
});
