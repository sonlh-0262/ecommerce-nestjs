import { Logger } from '@nestjs/common';
import { Command, CommandRunner } from 'nest-commander';

import {
  RUN_JOB_COMMAND,
  SCHEDULED_JOBS,
  ScheduledJobName,
} from '../../common/constants/scheduled-jobs';
import { OrdersScheduler } from '../../orders/orders.scheduler';
import { MonthlyReportScheduler } from '../../stats/monthly-report.scheduler';

const JOB_NAMES = Object.values(SCHEDULED_JOBS);

@Command({
  name: RUN_JOB_COMMAND,
  arguments: '<job>',
  description: `Run a scheduled job now, under its lock: ${JOB_NAMES.join(', ')}.`,
})
export class RunJobCommand extends CommandRunner {
  private readonly logger = new Logger(RunJobCommand.name);
  private readonly jobs: Record<ScheduledJobName, () => Promise<boolean>>;

  constructor(orders: OrdersScheduler, reports: MonthlyReportScheduler) {
    super();

    this.jobs = {
      [SCHEDULED_JOBS.MonthlyRevenueReport]: () =>
        reports.sendLastMonthReport(),
      [SCHEDULED_JOBS.OrdersAutoCancel]: () => orders.cancelExpiredOrders(),
    };
  }

  async run([name]: string[]): Promise<void> {
    if (!JOB_NAMES.includes(name as ScheduledJobName)) {
      throw new Error(
        `Unknown job "${name}". Expected one of: ${JOB_NAMES.join(', ')}.`,
      );
    }

    const ran = await this.jobs[name as ScheduledJobName]();

    this.logger.log(
      ran ? `Ran ${name}` : `Skipped ${name}: another run holds its lock`,
    );
  }
}
