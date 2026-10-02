import * as path from 'path';
import { DataSourceOptions } from 'typeorm';

import { DatabaseConfig } from '../config/database.config';
import { MIGRATIONS_TABLE_NAME, UUID_EXTENSION } from './database.constants';

const SOURCE_ROOT = path.join(__dirname, '..').replace(/\\/g, '/');

const ENTITIES_GLOB = `${SOURCE_ROOT}/**/*.entity.{ts,js}`;
const MIGRATIONS_GLOB = `${SOURCE_ROOT}/database/migrations/*.{ts,js}`;

export function buildDataSourceOptions(
  config: DatabaseConfig,
): DataSourceOptions {
  return {
    type: 'postgres',
    host: config.host,
    port: config.port,
    username: config.username,
    password: config.password,
    database: config.database,
    schema: config.schema,
    ssl: config.ssl,
    logging: config.logging,
    entities: [ENTITIES_GLOB],
    migrations: [MIGRATIONS_GLOB],
    migrationsTableName: MIGRATIONS_TABLE_NAME,
    synchronize: false,
    migrationsRun: false,
    uuidExtension: UUID_EXTENSION,
    installExtensions: false,
  };
}
