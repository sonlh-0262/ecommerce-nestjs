import { DataSource, EntityManager } from 'typeorm';

export function transactionalDataSource(manager = {} as EntityManager) {
  const transaction = jest.fn(
    (work: (manager: EntityManager) => Promise<unknown>) => work(manager),
  );

  return {
    manager,
    transaction,
    dataSource: { transaction } as unknown as DataSource,
  };
}
