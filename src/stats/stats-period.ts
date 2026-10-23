import {
  CalendarMonth,
  DateRange,
  RevenueWindow,
} from './interfaces/stats-period.interface';
import { MONTHS_PER_YEAR } from '../common/constants/time';
import {
  REVENUE_GROUPINGS,
  RevenueGroupBy,
  STATS_DEFAULT_RANGE_MONTHS,
} from './stats.constants';

const ZONED_PARTS = ['year', 'month', 'day', 'hour', 'minute', 'second'];

function zonedParts(instant: Date, timeZone: string): Record<string, number> {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  }).formatToParts(instant);

  return Object.fromEntries(
    parts
      .filter(({ type }) => ZONED_PARTS.includes(type))
      .map(({ type, value }) => [type, Number(value)]),
  );
}

function offsetOf(instant: Date, timeZone: string): number {
  const { year, month, day, hour, minute, second } = zonedParts(
    instant,
    timeZone,
  );
  const wholeSeconds = instant.getTime() - instant.getUTCMilliseconds();

  return Date.UTC(year, month - 1, day, hour, minute, second) - wholeSeconds;
}

export function monthOf(instant: Date, timeZone: string): CalendarMonth {
  const { year, month } = zonedParts(instant, timeZone);

  return { year, month };
}

export function addMonths(
  { year, month }: CalendarMonth,
  count: number,
): CalendarMonth {
  const index = year * MONTHS_PER_YEAR + month - 1 + count;

  return {
    year: Math.floor(index / MONTHS_PER_YEAR),
    month: (index % MONTHS_PER_YEAR) + 1,
  };
}

export function startOfMonth(
  { year, month }: CalendarMonth,
  timeZone: string,
): Date {
  const wallClock = Date.UTC(year, month - 1);
  const guess = wallClock - offsetOf(new Date(wallClock), timeZone);

  return new Date(wallClock - offsetOf(new Date(guess), timeZone));
}

export function monthRange(month: CalendarMonth, timeZone: string): DateRange {
  return {
    from: startOfMonth(month, timeZone),
    to: startOfMonth(addMonths(month, 1), timeZone),
  };
}

export function previousMonth(now: Date, timeZone: string): CalendarMonth {
  return addMonths(monthOf(now, timeZone), -1);
}

export function resolveRange(
  from: string | undefined,
  to: string | undefined,
  now: Date,
): DateRange {
  const end = to ? new Date(to) : now;

  if (from) {
    return { from: new Date(from), to: end };
  }

  const start = new Date(end);

  start.setUTCMonth(start.getUTCMonth() - STATS_DEFAULT_RANGE_MONTHS);

  return { from: start, to: end };
}

export function monthKey({ year, month }: CalendarMonth): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

function localDate(month: CalendarMonth): string {
  return `${monthKey(month)}-01`;
}

export function revenueWindow(
  groupBy: RevenueGroupBy,
  year: number,
  timeZone: string,
): RevenueWindow {
  const { unit, step, format, periods, monthsPerPeriod } =
    REVENUE_GROUPINGS[groupBy];
  const end: CalendarMonth = { year: year + 1, month: 1 };
  const first = addMonths(end, -periods * monthsPerPeriod);

  return {
    groupBy,
    unit,
    step,
    format,
    firstPeriod: localDate(first),
    lastPeriod: localDate(addMonths(end, -monthsPerPeriod)),
    timeZone,
    range: {
      from: startOfMonth(first, timeZone),
      to: startOfMonth(end, timeZone),
    },
  };
}
