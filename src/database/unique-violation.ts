import { QueryFailedError } from 'typeorm';

import { PG_UNIQUE_VIOLATION } from './database.constants';

export function uniqueViolationConstraint(error: unknown): string | null {
  if (!(error instanceof QueryFailedError)) {
    return null;
  }

  const { code, constraint } = error.driverError as {
    code?: string;
    constraint?: string;
  };

  return code === PG_UNIQUE_VIOLATION ? (constraint ?? null) : null;
}
