import { plainToInstance } from 'class-transformer';
import { IsOptional, validateSync } from 'class-validator';

import { IsIsoInstant } from './is-iso-instant.validator';

class RangeQuery {
  @IsOptional()
  @IsIsoInstant()
  from?: string;
}

describe('IsIsoInstant', () => {
  const errorsFor = (from: string) =>
    validateSync(plainToInstance(RangeQuery, { from }));

  it.each([
    '2026-01-01',
    '2026-01-01T00:00Z',
    '2026-01-01T00:00:00+07:00',
    '2026-01-01T23:59:59.999Z',
  ])('accepts %s, which Date reads as one instant', (value) => {
    expect(errorsFor(value)).toHaveLength(0);
    expect(Number.isNaN(new Date(value).getTime())).toBe(false);
  });

  it.each([
    ['20260101', 'a basic-format date Date cannot read'],
    ['2026-W01-1', 'a week date'],
    ['2026-001', 'an ordinal date read in local time'],
    ['2026-01-01T00:00:00', 'a time without an offset'],
    ['2026-02-30', 'a day the month does not have'],
  ])('rejects %s, %s', (value) => {
    expect(errorsFor(value)).not.toHaveLength(0);
  });
});
