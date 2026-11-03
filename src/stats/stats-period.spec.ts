import {
  addMonths,
  monthKey,
  monthOf,
  monthRange,
  previousMonth,
  resolveRange,
  revenueWindow,
  startOfMonth,
} from './stats-period';

describe('stats periods', () => {
  const HANOI = 'Asia/Ho_Chi_Minh';

  describe('startOfMonth', () => {
    it('puts midnight of the first day at the zone offset', () => {
      expect(startOfMonth({ year: 2026, month: 10 }, HANOI).toISOString()).toBe(
        '2026-09-30T17:00:00.000Z',
      );
    });

    it('is plain midnight in UTC', () => {
      expect(startOfMonth({ year: 2026, month: 10 }, 'UTC').toISOString()).toBe(
        '2026-10-01T00:00:00.000Z',
      );
    });

    it.each([
      [3, '2026-02-28T23:00:00.000Z'],
      [4, '2026-03-31T22:00:00.000Z'],
      [11, '2026-10-31T23:00:00.000Z'],
    ])('follows daylight saving time: month %i in Paris', (month, expected) => {
      expect(
        startOfMonth({ year: 2026, month }, 'Europe/Paris').toISOString(),
      ).toBe(expected);
    });
  });

  describe('monthOf', () => {
    it('reads the month on the wall clock of the zone', () => {
      const lateEvening = new Date('2026-09-30T18:30:00.000Z');

      expect(monthOf(lateEvening, HANOI)).toEqual({ year: 2026, month: 10 });
      expect(monthOf(lateEvening, 'UTC')).toEqual({ year: 2026, month: 9 });
    });
  });

  describe('addMonths', () => {
    it.each([
      [{ year: 2026, month: 12 }, 1, { year: 2027, month: 1 }],
      [{ year: 2026, month: 1 }, -1, { year: 2025, month: 12 }],
      [{ year: 2026, month: 3 }, -15, { year: 2024, month: 12 }],
    ])('moves %o by %i months', (month, count, expected) => {
      expect(addMonths(month, count)).toEqual(expected);
    });
  });

  describe('monthKey', () => {
    it('pads the month', () => {
      expect(monthKey({ year: 2026, month: 9 })).toBe('2026-09');
    });
  });

  describe('monthRange', () => {
    it('ends where the next month starts', () => {
      const { from, to } = monthRange({ year: 2026, month: 12 }, HANOI);

      expect(from.toISOString()).toBe('2026-11-30T17:00:00.000Z');
      expect(to.toISOString()).toBe('2026-12-31T17:00:00.000Z');
    });
  });

  describe('previousMonth', () => {
    it('is the month before the one running in the zone', () => {
      const firstOfOctoberInHanoi = new Date('2026-09-30T17:00:00.000Z');

      expect(previousMonth(firstOfOctoberInHanoi, HANOI)).toEqual({
        year: 2026,
        month: 9,
      });
    });

    it('rolls back over a new year', () => {
      expect(
        previousMonth(new Date('2027-01-01T05:00:00.000Z'), HANOI),
      ).toEqual({ year: 2026, month: 12 });
    });
  });

  describe('resolveRange', () => {
    const NOW = new Date('2026-10-18T03:00:00.000Z');

    it('covers the twelve months before now by default', () => {
      expect(resolveRange(undefined, undefined, NOW)).toEqual({
        from: new Date('2025-10-18T03:00:00.000Z'),
        to: NOW,
      });
    });

    it('counts the twelve months back from the end it is given', () => {
      expect(resolveRange(undefined, '2026-01-01T00:00:00Z', NOW)).toEqual({
        from: new Date('2025-01-01T00:00:00.000Z'),
        to: new Date('2026-01-01T00:00:00.000Z'),
      });
    });

    it('runs from the start it is given up to now', () => {
      expect(resolveRange('2026-01-01T00:00:00Z', undefined, NOW)).toEqual({
        from: new Date('2026-01-01T00:00:00.000Z'),
        to: NOW,
      });
    });

    it('leaves a reversed range for the caller to refuse', () => {
      const { from, to } = resolveRange('2026-05-01', '2026-01-01', NOW);

      expect(from > to).toBe(true);
    });
  });

  describe('revenueWindow', () => {
    it('frames the twelve months of the year', () => {
      expect(revenueWindow('month', 2026, HANOI)).toEqual({
        groupBy: 'month',
        unit: 'month',
        step: '1 month',
        format: 'YYYY-MM',
        firstPeriod: '2026-01-01',
        lastPeriod: '2026-12-01',
        timeZone: HANOI,
        range: {
          from: new Date('2025-12-31T17:00:00.000Z'),
          to: new Date('2026-12-31T17:00:00.000Z'),
        },
      });
    });

    it('frames five years ending with the one asked for', () => {
      expect(revenueWindow('year', 2026, HANOI)).toMatchObject({
        unit: 'year',
        step: '1 year',
        format: 'YYYY',
        firstPeriod: '2022-01-01',
        lastPeriod: '2026-01-01',
        range: {
          from: new Date('2021-12-31T17:00:00.000Z'),
          to: new Date('2026-12-31T17:00:00.000Z'),
        },
      });
    });
  });
});
