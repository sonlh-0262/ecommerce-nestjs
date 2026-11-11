import {
  SCHEDULED_JOB_LOCK_TTL_SECONDS,
  SCHEDULED_JOBS,
} from '../common/constants/scheduled-jobs';
import { RedisLockService } from '../redis/redis-lock.service';
import { PaymentRefundsService } from './payment-refunds.service';
import { PaymentsScheduler } from './payments.scheduler';

describe('PaymentsScheduler', () => {
  const lock = {
    runExclusive: jest.fn(
      (_name: string, _ttl: number, task: () => Promise<unknown>) =>
        task().then(() => true),
    ),
  };
  const refunds = { retryStale: jest.fn().mockResolvedValue(2) };

  const scheduler = new PaymentsScheduler(
    lock as unknown as RedisLockService,
    refunds as unknown as PaymentRefundsService,
  );

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('retries the stuck refunds as of now, under the job lock', async () => {
    jest.useFakeTimers({ now: new Date('2026-11-10T03:00:00.000Z') });

    await expect(scheduler.retryStaleRefunds()).resolves.toBe(true);

    expect(lock.runExclusive).toHaveBeenCalledWith(
      SCHEDULED_JOBS.PaymentRefundsRetry,
      SCHEDULED_JOB_LOCK_TTL_SECONDS[SCHEDULED_JOBS.PaymentRefundsRetry],
      expect.any(Function),
    );
    expect(refunds.retryStale).toHaveBeenCalledWith(
      new Date('2026-11-10T03:00:00.000Z'),
    );
  });
});
