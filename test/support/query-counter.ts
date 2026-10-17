import { DataSource } from 'typeorm';

export async function recordQueries(
  dataSource: DataSource,
  run: () => Promise<unknown>,
): Promise<string[]> {
  const spy = jest.spyOn(dataSource.logger, 'logQuery');

  try {
    await run();

    return spy.mock.calls.map(([query]) => query);
  } finally {
    spy.mockRestore();
  }
}
