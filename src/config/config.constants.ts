/**
 * Constants shared by the configuration layer.
 *
 * The bounds below are what `env.validation.ts` enforces at startup; keeping
 * them named means the error a developer gets ("must be less than or equal to
 * 15") can be traced back to the rule that produced it.
 */

/**
 * Env files every environment loads, in order of precedence. `.env.local` wins
 * so a developer can override the committed `.env` without touching it.
 *
 * `envFilePaths()` puts the files belonging to the current `NODE_ENV` in front
 * of these, which is how the e2e suite reaches its own database.
 */
export const BASE_ENV_FILE_PATHS = ['.env.local', '.env'];

/** TCP port range, used for every `*_PORT` variable. */
export const MIN_PORT = 1;
export const MAX_PORT = 65535;

/** Shortest `JWT_SECRET` accepted - 256 bits of entropy when hex-encoded. */
export const MIN_JWT_SECRET_LENGTH = 32;

/** `ms`-style duration accepted by `JWT_EXPIRES_IN`: `60`, `30s`, `15m`, `1d`. */
export const JWT_DURATION_PATTERN = /^\d+(ms|s|m|h|d|w|y)?$/;

/**
 * Range of `REDIS_DB`. Redis exposes 16 numbered logical databases (0-15) on
 * one server; this is an index, never a database name.
 */
export const MIN_REDIS_DB_INDEX = 0;
export const MAX_REDIS_DB_INDEX = 15;

/** Range bcrypt itself accepts for the cost factor. */
export const MIN_BCRYPT_SALT_ROUNDS = 4;
export const MAX_BCRYPT_SALT_ROUNDS = 31;

/**
 * Floor for the cost factor in production.
 *
 * A low cost makes tests and seeders quick, which is why the range above
 * allows it at all - but shipping it would make a stolen password table cheap
 * to crack, so production is held to the current accepted minimum.
 */
export const MIN_PRODUCTION_BCRYPT_SALT_ROUNDS = 10;

export const DEFAULT_THROTTLE_TTL_SECONDS = 60;
export const DEFAULT_THROTTLE_LIMIT = 100;
export const MIN_THROTTLE_VALUE = 1;

export const DEFAULT_MAIL_HOST = 'localhost';
export const DEFAULT_MAIL_PORT = 1025;
export const DEFAULT_MAIL_FROM = 'no-reply@ecommerce.local';
export const DEFAULT_MAIL_FROM_NAME = 'Ecommerce';

export const DEFAULT_APP_WEB_URL = 'http://localhost:3000';
export const WEB_URL_SCHEMES = ['http', 'https'];
export const NO_TRAILING_SLASH_PATTERN = /[^/]$/;
