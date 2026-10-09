import { readdir, rm } from 'fs/promises';
import * as path from 'path';

import { StorageConfig } from '../../src/config/storage.config';
import { TEST_STORAGE_ROOT_LEAF } from './test.constants';

export function assertTestStorage(config: StorageConfig): void {
  if (path.basename(path.resolve(config.root)) === TEST_STORAGE_ROOT_LEAF) {
    return;
  }

  throw new Error(
    `Refusing to run the e2e suite with STORAGE_ROOT "${config.root}": the ` +
      `suite deletes that directory between test cases, so it must end in ` +
      `"${TEST_STORAGE_ROOT_LEAF}". Check .env.test.`,
  );
}

export async function clearStorage(config: StorageConfig): Promise<void> {
  await rm(path.resolve(config.root), { recursive: true, force: true });
}

export async function storedFiles(config: StorageConfig): Promise<string[]> {
  const root = path.resolve(config.root);
  const entries = await readdir(root, {
    recursive: true,
    withFileTypes: true,
  }).catch(() => []);

  return entries
    .filter((entry) => entry.isFile())
    .map((entry) =>
      path
        .relative(root, path.join(entry.parentPath, entry.name))
        .split(path.sep)
        .join('/'),
    );
}
