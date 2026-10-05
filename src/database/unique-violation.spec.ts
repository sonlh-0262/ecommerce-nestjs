import { QueryFailedError } from 'typeorm';

import {
  PG_FOREIGN_KEY_VIOLATION,
  PG_UNIQUE_VIOLATION,
} from './database.constants';
import { uniqueViolationConstraint } from './unique-violation';

describe('uniqueViolationConstraint', () => {
  const failure = (code: string, constraint?: string) =>
    new QueryFailedError('INSERT ...', [], {
      code,
      constraint,
    } as unknown as Error);

  it('names the unique index that was violated', () => {
    expect(
      uniqueViolationConstraint(failure(PG_UNIQUE_VIOLATION, 'UQ_users_email')),
    ).toBe('UQ_users_email');
  });

  it('returns null for another database error', () => {
    expect(
      uniqueViolationConstraint(failure(PG_FOREIGN_KEY_VIOLATION, 'FK_x')),
    ).toBeNull();
  });

  it('returns null when the driver does not name the constraint', () => {
    expect(uniqueViolationConstraint(failure(PG_UNIQUE_VIOLATION))).toBeNull();
  });

  it('returns null for an error that did not come from the database', () => {
    expect(uniqueViolationConstraint(new Error('boom'))).toBeNull();
  });
});
