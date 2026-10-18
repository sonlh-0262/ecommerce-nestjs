import { RevenueGroupBy } from '../stats.constants';

export interface DateRange {
  from: Date;
  to: Date;
}

export interface CalendarMonth {
  year: number;
  month: number;
}

export interface RevenueWindow {
  groupBy: RevenueGroupBy;
  unit: string;
  step: string;
  format: string;
  firstPeriod: string;
  lastPeriod: string;
  timeZone: string;
  range: DateRange;
}
