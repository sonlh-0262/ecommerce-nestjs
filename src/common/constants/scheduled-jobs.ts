import { SECONDS_PER_MINUTE } from './time';

export const RUN_JOB_COMMAND = 'job:run';

export const SCHEDULED_JOBS = {
  MonthlyRevenueReport: 'monthly-revenue-report',
  OrdersAutoCancel: 'orders-auto-cancel',
} as const;

export type ScheduledJobName =
  (typeof SCHEDULED_JOBS)[keyof typeof SCHEDULED_JOBS];

export const SCHEDULED_JOB_LOCK_TTL_SECONDS: Record<ScheduledJobName, number> =
  {
    [SCHEDULED_JOBS.MonthlyRevenueReport]: 5 * SECONDS_PER_MINUTE,
    [SCHEDULED_JOBS.OrdersAutoCancel]: 2 * SECONDS_PER_MINUTE,
  };
