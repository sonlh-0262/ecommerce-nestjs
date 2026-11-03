import {
  SCHEDULED_JOB_LOCK_TTL_SECONDS,
  SCHEDULED_JOBS,
} from '../common/constants/scheduled-jobs';
import { RedisLockService } from '../redis/redis-lock.service';
import { OrderExpiryService } from './order-expiry.service';
import { OrdersScheduler } from './orders.scheduler';

describe('OrdersScheduler', () => {
  const lockMock = {
    runExclusive: jest.fn(
      (_name: string, _ttl: number, task: () => Promise<unknown>) =>
        task().then(() => true),
    ),
  };
  const expiryMock = { cancelExpired: jest.fn().mockResolvedValue(3) };

  const scheduler = new OrdersScheduler(
    lockMock as unknown as RedisLockService,
    expiryMock as unknown as OrderExpiryService,
  );

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('cancels the expired orders as of now, under the job lock', async () => {
    jest.useFakeTimers({ now: new Date('2026-10-18T10:00:00.000Z') });

    await expect(scheduler.cancelExpiredOrders()).resolves.toBe(true);

    expect(lockMock.runExclusive).toHaveBeenCalledWith(
      SCHEDULED_JOBS.OrdersAutoCancel,
      SCHEDULED_JOB_LOCK_TTL_SECONDS[SCHEDULED_JOBS.OrdersAutoCancel],
      expect.any(Function),
    );
    expect(expiryMock.cancelExpired).toHaveBeenCalledWith(
      new Date('2026-10-18T10:00:00.000Z'),
    );
  });

  it('does nothing while another instance holds the lock', async () => {
    lockMock.runExclusive.mockResolvedValueOnce(false);

    await expect(scheduler.cancelExpiredOrders()).resolves.toBe(false);

    expect(expiryMock.cancelExpired).not.toHaveBeenCalled();
  });
});
