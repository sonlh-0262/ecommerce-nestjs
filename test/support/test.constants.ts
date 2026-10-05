/** Postgres database the maintenance connection attaches to. */
export const MAINTENANCE_DATABASE = 'postgres';

/** PostgreSQL `duplicate_database` SQLSTATE. */
export const PG_DUPLICATE_DATABASE = '42P04';

/**
 * Suffix `DB_DATABASE` must end in before the suite will run: the guard that
 * stops `clearDatabase()` from emptying a development database.
 */
export const TEST_DATABASE_SUFFIX = '_test';

/** Marker `REDIS_KEY_PREFIX` must contain, for the same reason. */
export const TEST_REDIS_KEY_PREFIX_MARKER = 'test';

/** Password every fixture account is created with. */
export const SEEDED_USER_PASSWORD = 'Password@123';

/**
 * The public URLs, as `document/02-api-endpoints.md` §0 and §15 fix them.
 *
 * Written out rather than read back from `ConfigService`, so a change to
 * `API_PREFIX` or `SWAGGER_PATH` fails this suite instead of silently moving
 * every published endpoint.
 */
export const API_BASE_PATH = '/api/v1';

/** Outside the versioned prefix: a probe, not part of the API contract. */
export const HEALTH_PATH = '/health';

export const SWAGGER_PATH = '/docs';

export const AUTH_PATHS = {
  register: `${API_BASE_PATH}/auth/register`,
  verifyEmail: `${API_BASE_PATH}/auth/verify-email`,
  resendVerification: `${API_BASE_PATH}/auth/resend-verification`,
  login: `${API_BASE_PATH}/auth/login`,
  logout: `${API_BASE_PATH}/auth/logout`,
  forgotPassword: `${API_BASE_PATH}/auth/forgot-password`,
  resetPassword: `${API_BASE_PATH}/auth/reset-password`,
} as const;
