import {
  MONTHS_PER_YEAR,
  SECONDS_PER_DAY,
  SECONDS_PER_MINUTE,
} from '../common/constants/time';
import { ORDERS_DELIVERED_CONDITION } from '../orders/orders.constants';

export const STATS_DEFAULT_RANGE_MONTHS = 12;

export const STATS_OVERVIEW_CACHE_TTL_SECONDS = 5 * SECONDS_PER_MINUTE;

export const DELIVERED_ORDER_CONDITION = `order.${ORDERS_DELIVERED_CONDITION}`;

export const BEST_SELLERS_DEFAULT_LIMIT = 10;
export const BEST_SELLERS_MIN_LIMIT = 1;
export const BEST_SELLERS_MAX_LIMIT = 50;

export const REVENUE_GROUP_BY = ['month', 'year'] as const;

export type RevenueGroupBy = (typeof REVENUE_GROUP_BY)[number];

export interface RevenueGrouping {
  unit: string;
  step: string;
  format: string;
  periods: number;
  monthsPerPeriod: number;
}

export const REVENUE_GROUPINGS: Record<RevenueGroupBy, RevenueGrouping> = {
  month: {
    unit: 'month',
    step: '1 month',
    format: 'YYYY-MM',
    periods: MONTHS_PER_YEAR,
    monthsPerPeriod: 1,
  },
  year: {
    unit: 'year',
    step: '1 year',
    format: 'YYYY',
    periods: 5,
    monthsPerPeriod: MONTHS_PER_YEAR,
  },
};

export const REVENUE_MIN_YEAR = 2000;
export const REVENUE_MAX_YEAR = 2100;

export const MONTHLY_REPORT_CRON = '0 0 1 * *';

export const MONTHLY_REPORT_CLAIM_TTL_SECONDS = SECONDS_PER_DAY;

export const MONTHLY_REPORT_TOP_PRODUCTS = 5;
