import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, readdir, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import * as path from 'path';
import { DataSource } from 'typeorm';

import { CacheService } from '../../cache/cache.service';
import { CACHE_RESOURCES } from '../../common/constants/cache-keys';
import { STORAGE_CONFIG_KEY } from '../../config/storage.config';
import { SeedDataReset } from './seed-data-reset';

describe('SeedDataReset', () => {
  const root = path.join(tmpdir(), `seed-data-reset-${process.pid}`);
  const dataSourceMock = {
    entityMetadatas: [
      { tablePath: 'users' },
      { tablePath: 'shop.orders' },
      { tablePath: 'users' },
    ],
    driver: { escape: (name: string) => `"${name}"` },
    query: jest.fn(),
  };
  const cacheMock = { invalidate: jest.fn() };

  const reset = (storageRoot = root) =>
    new SeedDataReset(
      dataSourceMock as unknown as DataSource,
      cacheMock as unknown as CacheService,
      {
        getOrThrow: (key: string) =>
          key === STORAGE_CONFIG_KEY ? { root: storageRoot } : undefined,
      } as unknown as ConfigService,
    );

  beforeEach(async () => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    await mkdir(path.join(root, '2026', '10'), { recursive: true });
    await writeFile(path.join(root, '2026', '10', 'a.png'), 'x');
    await writeFile(path.join(root, 'b.png'), 'x');
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    await rm(root, { recursive: true, force: true });
  });

  it('truncates every entity table once, quoted, resetting identities', async () => {
    await reset().run();

    expect(dataSourceMock.query).toHaveBeenCalledWith(
      'TRUNCATE "users", "shop"."orders" RESTART IDENTITY CASCADE',
    );
  });

  it('invalidates every cached resource', async () => {
    await reset().run();

    expect(cacheMock.invalidate).toHaveBeenCalledWith(
      ...Object.values(CACHE_RESOURCES),
    );
  });

  it('empties the storage directory but keeps it', async () => {
    await reset().run();

    await expect(readdir(root)).resolves.toEqual([]);
  });

  it('tolerates a storage directory that does not exist yet', async () => {
    await rm(root, { recursive: true, force: true });

    await expect(reset().run()).resolves.toBeUndefined();
  });

  it.each([
    ['the working directory', process.cwd()],
    ['a parent of the working directory', path.dirname(process.cwd())],
    ['the filesystem root', path.parse(process.cwd()).root],
  ])('refuses %s before touching the database', async (_case, unsafe) => {
    await expect(reset(unsafe).run()).rejects.toThrow(/STORAGE_ROOT/);

    expect(dataSourceMock.query).not.toHaveBeenCalled();
  });
});
