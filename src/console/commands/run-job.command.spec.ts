import { Logger } from '@nestjs/common';

import { SCHEDULED_JOBS } from '../../common/constants/scheduled-jobs';
import { OrdersScheduler } from '../../orders/orders.scheduler';
import { MonthlyReportScheduler } from '../../stats/monthly-report.scheduler';
import { RunJobCommand } from './run-job.command';

describe('RunJobCommand', () => {
  const ordersMock = { cancelExpiredOrders: jest.fn().mockResolvedValue(true) };
  const reportsMock = {
    sendLastMonthReport: jest.fn().mockResolvedValue(true),
  };

  const command = new RunJobCommand(
    ordersMock as unknown as OrdersScheduler,
    reportsMock as unknown as MonthlyReportScheduler,
  );

  let log: jest.SpyInstance;

  beforeEach(() => {
    log = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('runs the monthly report', async () => {
    await command.run([SCHEDULED_JOBS.MonthlyRevenueReport]);

    expect(reportsMock.sendLastMonthReport).toHaveBeenCalledTimes(1);
    expect(ordersMock.cancelExpiredOrders).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(
      `Ran ${SCHEDULED_JOBS.MonthlyRevenueReport}`,
    );
  });

  it('runs the auto-cancel job', async () => {
    await command.run([SCHEDULED_JOBS.OrdersAutoCancel]);

    expect(ordersMock.cancelExpiredOrders).toHaveBeenCalledTimes(1);
  });

  it('says when another run held the lock', async () => {
    ordersMock.cancelExpiredOrders.mockResolvedValueOnce(false);

    await command.run([SCHEDULED_JOBS.OrdersAutoCancel]);

    expect(log).toHaveBeenCalledWith(
      `Skipped ${SCHEDULED_JOBS.OrdersAutoCancel}: another run holds its lock`,
    );
  });

  it.each(['send-everything', 'constructor'])(
    'refuses the unknown job %s',
    async (name) => {
      await expect(command.run([name])).rejects.toThrow(
        `Unknown job "${name}"`,
      );
    },
  );
});
