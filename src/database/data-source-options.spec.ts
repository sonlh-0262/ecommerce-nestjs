import { DEFAULT_DB_SLOW_QUERY_MS } from '../config/config.constants';
import databaseConfig from '../config/database.config';
import { buildDataSourceOptions } from './data-source-options';

describe('buildDataSourceOptions', () => {
  const original = process.env.DB_SLOW_QUERY_MS;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.DB_SLOW_QUERY_MS;
    } else {
      process.env.DB_SLOW_QUERY_MS = original;
    }
  });

  it('logs queries slower than the default threshold', () => {
    delete process.env.DB_SLOW_QUERY_MS;

    expect(buildDataSourceOptions(databaseConfig())).toMatchObject({
      maxQueryExecutionTime: DEFAULT_DB_SLOW_QUERY_MS,
    });
  });

  it('takes the threshold from DB_SLOW_QUERY_MS', () => {
    process.env.DB_SLOW_QUERY_MS = '50';

    expect(buildDataSourceOptions(databaseConfig())).toMatchObject({
      maxQueryExecutionTime: 50,
    });
  });

  it('never synchronizes the schema', () => {
    expect(buildDataSourceOptions(databaseConfig())).toMatchObject({
      synchronize: false,
      migrationsRun: false,
    });
  });
});
