import { DataSource } from 'typeorm';

import { buildDataSourceOptions } from './data-source-options';

interface MetadataBuilder {
  buildMetadatas(): Promise<void>;
}

export async function offlineDataSource(): Promise<DataSource> {
  const dataSource = new DataSource(
    buildDataSourceOptions({
      host: 'offline',
      port: 0,
      username: 'offline',
      password: 'offline',
      database: 'offline',
      schema: 'public',
      ssl: false,
      logging: false,
    }),
  );

  await (dataSource as unknown as MetadataBuilder).buildMetadatas();

  return dataSource;
}
