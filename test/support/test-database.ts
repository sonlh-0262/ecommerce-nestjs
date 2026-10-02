import { DataSource, EntityMetadata } from 'typeorm';

import { DatabaseConfig } from '../../src/config/database.config';
import { TEST_DATABASE_SUFFIX } from './test.constants';

/** Built once per data source: the statement cannot change while the app is up. */
const clearStatements = new WeakMap<DataSource, string>();

/** Called before `init()`, so a misconfigured run fails instead of emptying. */
export function assertTestDatabase(config: DatabaseConfig): void {
  if (config.database.endsWith(TEST_DATABASE_SUFFIX)) {
    return;
  }

  throw new Error(
    `Refusing to run the e2e suite against "${config.database}": the suite ` +
      `empties every table between test cases, so DB_DATABASE must name a ` +
      `database ending in "${TEST_DATABASE_SUFFIX}". Check .env.test.`,
  );
}

/**
 * Empties every table the entities map to.
 *
 * `DELETE` rather than `TRUNCATE`: `TRUNCATE` rewrites and fsyncs the file
 * behind every relation, so its cost follows the number of tables rather than
 * the number of rows - far more expensive between cases that insert a handful.
 *
 * The migrations table is not an entity, so it survives: the schema is built
 * once per run by `global-setup.ts`.
 */
export async function clearDatabase(dataSource: DataSource): Promise<void> {
  const statement = clearStatement(dataSource);

  if (statement) {
    await dataSource.query(statement);
  }
}

function clearStatement(dataSource: DataSource): string {
  const cached = clearStatements.get(dataSource);

  if (cached !== undefined) {
    return cached;
  }

  const statement = deletionOrder(dataSource)
    .map((table) => `DELETE FROM ${table}`)
    .join('; ');

  clearStatements.set(dataSource, statement);

  return statement;
}

/**
 * Table paths ordered so each comes before every table it references: a
 * depth-first walk of the reversed foreign-key graph. Marking on entry rather
 * than exit breaks a cycle at an arbitrary edge instead of recursing forever.
 */
function deletionOrder(dataSource: DataSource): string[] {
  const dependents = new Map<string, EntityMetadata[]>();

  for (const metadata of dataSource.entityMetadatas) {
    for (const foreignKey of metadata.foreignKeys) {
      const referenced = foreignKey.referencedEntityMetadata.tablePath;

      dependents.set(referenced, [
        ...(dependents.get(referenced) ?? []),
        metadata,
      ]);
    }
  }

  const visited = new Set<string>();
  const order: string[] = [];

  const visit = (metadata: EntityMetadata): void => {
    if (visited.has(metadata.tablePath)) {
      return;
    }

    visited.add(metadata.tablePath);
    (dependents.get(metadata.tablePath) ?? []).forEach(visit);
    order.push(metadata.tablePath);
  };

  dataSource.entityMetadatas.forEach(visit);

  return order;
}
