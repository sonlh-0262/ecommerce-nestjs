import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';

import databaseConfig, {
  DatabaseConfig,
} from '../../src/config/database.config';
import { envFilePaths } from '../../src/config/env-files';
import { buildDataSourceOptions } from '../../src/database/data-source-options';
import { assertTestDatabase } from './test-database';
import { MAINTENANCE_DATABASE, PG_DUPLICATE_DATABASE } from './test.constants';

/**
 * Creates and migrates the test database once per run, so `npm run test:e2e`
 * works on a fresh checkout. The schema does not change between cases - only
 * the rows, which `clearDatabase()` handles.
 *
 * Nothing here sets `NODE_ENV`: the Jest CLI already sets it to `test` unless
 * it is already set. An inherited `NODE_ENV=development` would win, and the
 * suite would read `.env` and be refused by `assertTestDatabase`.
 */
export default async function globalSetup(): Promise<void> {
  loadEnv({ path: envFilePaths(), quiet: true });

  const config = databaseConfig();
  assertTestDatabase(config);

  await createDatabaseIfMissing(config);
  await migrate(config);
}

async function createDatabaseIfMissing(config: DatabaseConfig): Promise<void> {
  const maintenance = new DataSource({
    type: 'postgres',
    host: config.host,
    port: config.port,
    username: config.username,
    password: config.password,
    database: MAINTENANCE_DATABASE,
    ssl: config.ssl,
  });

  await maintenance.initialize();

  try {
    const existing = await maintenance.query<unknown[]>(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [config.database],
    );

    if (existing.length > 0) {
      return;
    }

    // The name cannot be bound as a parameter in DDL. It comes from
    // `.env.test` and has already passed `assertTestDatabase`.
    await maintenance.query(`CREATE DATABASE "${config.database}"`);
  } catch (error) {
    // Two jest projects starting at once both see it missing and both create
    // it; the loser can carry on.
    if ((error as { code?: string }).code !== PG_DUPLICATE_DATABASE) {
      throw error;
    }
  } finally {
    await maintenance.destroy();
  }
}

async function migrate(config: DatabaseConfig): Promise<void> {
  const dataSource = new DataSource(buildDataSourceOptions(config));

  await dataSource.initialize();

  try {
    await dataSource.query(`CREATE SCHEMA IF NOT EXISTS "${config.schema}"`);
    await dataSource.runMigrations();
  } finally {
    await dataSource.destroy();
  }
}
