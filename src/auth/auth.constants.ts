import { UserStatus } from '../users/enums/user-status.enum';

/**
 * Constants owned by the auth module.
 *
 * Kept in one file so the strategy, the guard, the module wiring and the
 * service all share the same literals instead of each re-declaring a copy.
 */

/**
 * Name the JWT Passport strategy registers itself under.
 *
 * `PassportModule.register`, `PassportStrategy(...)` and `AuthGuard(...)` have
 * to agree on this string or the guard resolves no strategy at runtime.
 */
export const JWT_STRATEGY_NAME = 'jwt';

/** Redis key prefix for the denylist of revoked token ids (`jti`). */
export const TOKEN_DENYLIST_KEY_PREFIX = 'auth:denylist:';

/** Redis value stored against a revoked `jti`; only the key's existence matters. */
export const TOKEN_DENYLIST_VALUE = '1';

/** JWT timestamps (`iat`, `exp`) are seconds; `Date` works in milliseconds. */
export const MILLISECONDS_PER_SECOND = 1000;

/**
 * Hash compared against when login is given an unknown email, so a request for
 * a missing account costs the same bcrypt work as one for an existing account
 * and the two cannot be told apart by response time.
 *
 * Its plaintext is irrelevant: login rejects an unknown email whatever the
 * comparison returns. What matters is that it is a well-formed bcrypt hash at
 * the same cost factor as a real one.
 */
export const DUMMY_PASSWORD_HASH =
  '$2b$10$18jA5vncNymIApDQRXbrwOB7ht1TAxRfCgTJV.k06jUOU18IWZl5e';

/**
 * Why an account in a given status may not authenticate.
 *
 * A status absent from this map is one that may: today that is only `ACTIVE`,
 * and adding a status without deciding either way is a compile error rather
 * than an accidental grant.
 */
export const ACCOUNT_STATUS_REJECTIONS: Record<UserStatus, string | undefined> =
  {
    [UserStatus.Pending]: 'auth.ACCOUNT_PENDING',
    [UserStatus.Inactive]: 'auth.ACCOUNT_INACTIVE',
    [UserStatus.Active]: undefined,
  };
