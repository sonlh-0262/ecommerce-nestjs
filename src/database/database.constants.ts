/**
 * Constants owned by the database module.
 *
 * The TypeORM CLI data source and the Nest `TypeOrmModule` both build their
 * options from `buildDataSourceOptions`, so these only need to be right once -
 * but a migration generated against different values would be silently wrong,
 * which is why they live here rather than inline.
 */

/** Table TypeORM records applied migrations in. */
export const MIGRATIONS_TABLE_NAME = 'migrations';

/** Postgres extension providing `gen_random_uuid()` for uuid primary keys. */
export const UUID_EXTENSION = 'pgcrypto';

export const PG_UNIQUE_VIOLATION = '23505';
export const PG_FOREIGN_KEY_VIOLATION = '23503';
export const PG_CHECK_VIOLATION = '23514';
