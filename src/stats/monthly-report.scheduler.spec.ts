import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';

import {
  RUN_JOB_COMMAND,
  SCHEDULED_JOB_LOCK_TTL_SECONDS,
  SCHEDULED_JOBS,
} from '../common/constants/scheduled-jobs';
import { RedisLockService } from '../redis/redis-lock.service';
import { MonthlyReportScheduler } from './monthly-report.scheduler';
import { MonthlyReportService } from './monthly-report.service';
import { MONTHLY_REPORT_CLAIM_TTL_SECONDS } from './stats.constants';

describe('MonthlyReportScheduler', () => {
  const JOB = SCHEDULED_JOBS.MonthlyRevenueReport;
  const OCTOBER_1_IN_HANOI = new Date('2026-09-30T17:00:00.000Z');
  const SEPTEMBER = { year: 2026, month: 9 };

  const registry = new SchedulerRegistry();
  const claimed = new Set<string>();
  const lockMock = {
    claim: jest.fn((name: string) => {
      const fresh = !claimed.has(name);

      claimed.add(name);

      return Promise.resolve(fresh);
    }),
    runExclusive: jest.fn(
      (_name: string, _ttl: number, task: () => Promise<unknown>) =>
        task().then(() => true),
    ),
  };
  const reportsMock = { send: jest.fn().mockResolvedValue(1) };
  const configMock = { getOrThrow: () => ({ timeZone: 'Asia/Ho_Chi_Minh' }) };

  const scheduler = new MonthlyReportScheduler(
    registry,
    lockMock as unknown as RedisLockService,
    reportsMock as unknown as MonthlyReportService,
    configMock as unknown as ConfigService,
  );

  let logError: jest.SpyInstance;

  beforeEach(() => {
    claimed.clear();
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    logError = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();

    if (registry.doesExist('cron', JOB)) {
      registry.deleteCronJob(JOB);
    }
  });

  it('runs at midnight on the first of every month, shop time', () => {
    scheduler.onApplicationBootstrap();

    const job: CronJob = registry.getCronJob(JOB);

    expect(job.isActive).toBe(true);
    expect(job.nextDate().toISO()).toMatch(/-01T00:00:00\.000\+07:00$/);
  });

  describe('sendScheduledReport', () => {
    it('claims the month that just ended and sends its report', async () => {
      await expect(
        scheduler.sendScheduledReport(OCTOBER_1_IN_HANOI),
      ).resolves.toBe(true);

      expect(lockMock.claim).toHaveBeenCalledWith(
        `${JOB}:2026-09`,
        MONTHLY_REPORT_CLAIM_TTL_SECONDS,
      );
      expect(reportsMock.send).toHaveBeenCalledWith(SEPTEMBER);
    });

    it('sends a month once, however many instances tick', async () => {
      await scheduler.sendScheduledReport(OCTOBER_1_IN_HANOI);

      await expect(
        scheduler.sendScheduledReport(OCTOBER_1_IN_HANOI),
      ).resolves.toBe(false);
      expect(reportsMock.send).toHaveBeenCalledTimes(1);
    });

    it('logs a failure with the command that sends the report by hand', async () => {
      reportsMock.send.mockRejectedValueOnce(new Error('db down'));

      await expect(
        scheduler.sendScheduledReport(OCTOBER_1_IN_HANOI),
      ).resolves.toBe(false);
      expect(logError).toHaveBeenCalledWith(
        `${JOB} for 2026-09 failed: db down. Send it with ` +
          `"npm run console -- ${RUN_JOB_COMMAND} ${JOB}".`,
      );
    });

    it('logs it as well when Redis cannot be reached', async () => {
      lockMock.claim.mockRejectedValueOnce(new Error('connection refused'));

      await expect(
        scheduler.sendScheduledReport(OCTOBER_1_IN_HANOI),
      ).resolves.toBe(false);
      expect(reportsMock.send).not.toHaveBeenCalled();
      expect(logError).toHaveBeenCalledTimes(1);
    });

    it('is what the cron ticks', async () => {
      scheduler.onApplicationBootstrap();

      await registry.getCronJob(JOB).fireOnTick();
      await new Promise((resolve) => setImmediate(resolve));

      expect(lockMock.claim).toHaveBeenCalledTimes(1);
    });
  });

  describe('sendLastMonthReport', () => {
    it('sends again on demand, under the job lock', async () => {
      await scheduler.sendScheduledReport(OCTOBER_1_IN_HANOI);

      await expect(
        scheduler.sendLastMonthReport(OCTOBER_1_IN_HANOI),
      ).resolves.toBe(true);

      expect(lockMock.runExclusive).toHaveBeenCalledWith(
        JOB,
        SCHEDULED_JOB_LOCK_TTL_SECONDS[JOB],
        expect.any(Function),
      );
      expect(reportsMock.send).toHaveBeenCalledTimes(2);
    });
  });
});
