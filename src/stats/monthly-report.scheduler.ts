import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';

import {
  RUN_JOB_COMMAND,
  SCHEDULED_JOB_LOCK_TTL_SECONDS,
  SCHEDULED_JOBS,
} from '../common/constants/scheduled-jobs';
import { errorMessage } from '../common/helpers/error-message';
import { APP_CONFIG_KEY, AppConfig } from '../config/configuration';
import { RedisLockService } from '../redis/redis-lock.service';
import { MonthlyReportService } from './monthly-report.service';
import { monthKey, previousMonth } from './stats-period';
import {
  MONTHLY_REPORT_CLAIM_TTL_SECONDS,
  MONTHLY_REPORT_CRON,
} from './stats.constants';

const JOB = SCHEDULED_JOBS.MonthlyRevenueReport;

@Injectable()
export class MonthlyReportScheduler implements OnApplicationBootstrap {
  private readonly logger = new Logger(MonthlyReportScheduler.name);
  private readonly timeZone: string;

  constructor(
    private readonly registry: SchedulerRegistry,
    private readonly lock: RedisLockService,
    private readonly reports: MonthlyReportService,
    configService: ConfigService,
  ) {
    this.timeZone =
      configService.getOrThrow<AppConfig>(APP_CONFIG_KEY).timeZone;
  }

  onApplicationBootstrap(): void {
    this.registry.addCronJob(
      JOB,
      CronJob.from({
        cronTime: MONTHLY_REPORT_CRON,
        timeZone: this.timeZone,
        onTick: () => void this.sendScheduledReport(),
        start: true,
      }),
    );
  }

  async sendScheduledReport(now = new Date()): Promise<boolean> {
    const month = previousMonth(now, this.timeZone);
    const period = monthKey(month);

    try {
      if (
        !(await this.lock.claim(
          `${JOB}:${period}`,
          MONTHLY_REPORT_CLAIM_TTL_SECONDS,
        ))
      ) {
        this.logger.log(`${JOB} for ${period} was already sent`);

        return false;
      }

      await this.reports.send(month);

      return true;
    } catch (error) {
      this.logger.error(
        `${JOB} for ${period} failed: ${errorMessage(error)}. Send it with ` +
          `"npm run console -- ${RUN_JOB_COMMAND} ${JOB}".`,
      );

      return false;
    }
  }

  sendLastMonthReport(now = new Date()): Promise<boolean> {
    return this.lock.runExclusive(
      JOB,
      SCHEDULED_JOB_LOCK_TTL_SECONDS[JOB],
      () => this.reports.send(previousMonth(now, this.timeZone)),
    );
  }
}
