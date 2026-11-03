import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';

import { MAIL_FALLBACK_LANGUAGE, MAIL_JOB } from '../mail/mail.constants';
import { MailQueueService } from '../mail/mail-queue.service';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/enums/user-role.enum';
import { UserStatus } from '../users/enums/user-status.enum';
import { MonthlyReportService } from './monthly-report.service';
import { StatsMetricsService } from './stats-metrics.service';
import { MONTHLY_REPORT_TOP_PRODUCTS } from './stats.constants';

describe('MonthlyReportService', () => {
  const SEPTEMBER = { year: 2026, month: 9 };
  const SEPTEMBER_RANGE = {
    from: new Date('2026-08-31T17:00:00.000Z'),
    to: new Date('2026-09-30T17:00:00.000Z'),
  };
  const AUGUST_RANGE = {
    from: new Date('2026-07-31T17:00:00.000Z'),
    to: new Date('2026-08-31T17:00:00.000Z'),
  };
  const ADMINS = [
    { id: 'a1', email: 'admin@example.com', fullName: 'Seed Admin' },
    { id: 'a2', email: 'boss@example.com', fullName: null },
  ];

  const metricsMock = {
    deliveredTotals: jest.fn(({ from }: { from: Date }) =>
      Promise.resolve(
        from.getTime() === SEPTEMBER_RANGE.from.getTime()
          ? { orders: 3, revenue: 1_500_000 }
          : { orders: 2, revenue: 1_000_000 },
      ),
    ),
    bestSellers: jest.fn().mockResolvedValue({
      products: [
        {
          id: 'p1',
          name: 'Áo thun',
          slug: 'ao-thun',
          isDeleted: false,
          thumbnailUrl: null,
          soldQuantity: 4,
          revenue: 800_000,
        },
      ],
      total: 1,
    }),
  };
  const usersRepository = { find: jest.fn().mockResolvedValue(ADMINS) };
  const mailMock = { enqueue: jest.fn() };
  const configMock = { getOrThrow: () => ({ timeZone: 'Asia/Ho_Chi_Minh' }) };

  const service = new MonthlyReportService(
    metricsMock as unknown as StatsMetricsService,
    usersRepository as unknown as Repository<User>,
    mailMock as unknown as MailQueueService,
    configMock as unknown as ConfigService,
  );

  const REPORT = {
    year: 2026,
    month: 9,
    current: { orders: 3, revenue: 1_500_000 },
    previous: { orders: 2, revenue: 1_000_000 },
    topProducts: [{ name: 'Áo thun', soldQuantity: 4, revenue: 800_000 }],
  };

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('builds the month against the one before, in the shop time zone', async () => {
    await expect(service.build(SEPTEMBER)).resolves.toEqual(REPORT);

    expect(metricsMock.deliveredTotals).toHaveBeenCalledWith(SEPTEMBER_RANGE);
    expect(metricsMock.deliveredTotals).toHaveBeenCalledWith(AUGUST_RANGE);
    expect(metricsMock.bestSellers).toHaveBeenCalledWith(
      SEPTEMBER_RANGE,
      MONTHLY_REPORT_TOP_PRODUCTS,
    );
  });

  it('compares January with December of the year before', async () => {
    await service.build({ year: 2026, month: 1 });

    expect(metricsMock.deliveredTotals).toHaveBeenCalledWith({
      from: new Date('2025-11-30T17:00:00.000Z'),
      to: new Date('2025-12-31T17:00:00.000Z'),
    });
  });

  it('emails the report to every active admin', async () => {
    await expect(service.send(SEPTEMBER)).resolves.toBe(2);

    expect(usersRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { role: UserRole.Admin, status: UserStatus.Active },
      }),
    );
    expect(mailMock.enqueue).toHaveBeenCalledTimes(2);
    expect(mailMock.enqueue).toHaveBeenCalledWith(
      MAIL_JOB.MonthlyRevenueReport,
      {
        ...REPORT,
        to: 'boss@example.com',
        fullName: null,
        lang: MAIL_FALLBACK_LANGUAGE,
      },
    );
  });
});
