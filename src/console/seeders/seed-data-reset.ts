import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readdir, rm } from 'fs/promises';
import * as path from 'path';
import { DataSource } from 'typeorm';

import { CacheService } from '../../cache/cache.service';
import { CACHE_RESOURCES } from '../../common/constants/cache-keys';
import { STORAGE_CONFIG_KEY, StorageConfig } from '../../config/storage.config';

@Injectable()
export class SeedDataReset {
  private readonly logger = new Logger(SeedDataReset.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly cache: CacheService,
    private readonly configService: ConfigService,
  ) {}

  async run(): Promise<void> {
    const storageRoot = this.storageRoot();
    const tables = [
      ...new Set(
        this.dataSource.entityMetadatas.map(({ tablePath }) =>
          this.quoted(tablePath),
        ),
      ),
    ];

    await this.dataSource.query(
      `TRUNCATE ${tables.join(', ')} RESTART IDENTITY CASCADE`,
    );
    await this.cache.invalidate(...Object.values(CACHE_RESOURCES));
    await emptyDirectory(storageRoot);

    this.logger.log(`Emptied ${tables.length} tables and the file storage`);
  }

  private storageRoot(): string {
    const root = path.resolve(
      this.configService.getOrThrow<StorageConfig>(STORAGE_CONFIG_KEY).root,
    );
    const fromRoot = path.relative(root, process.cwd());
    const holdsWorkingDirectory =
      !fromRoot.startsWith('..') && !path.isAbsolute(fromRoot);

    if (root === path.parse(root).root || holdsWorkingDirectory) {
      throw new Error(
        `Refusing to empty STORAGE_ROOT "${root}": it is the filesystem ` +
          'root or contains the working directory.',
      );
    }

    return root;
  }

  private quoted(tablePath: string): string {
    return tablePath
      .split('.')
      .map((part) => this.dataSource.driver.escape(part))
      .join('.');
  }
}

async function emptyDirectory(directory: string): Promise<void> {
  const entries = await readdir(directory).catch(() => []);

  await Promise.all(
    entries.map((entry) =>
      rm(path.join(directory, entry), { recursive: true, force: true }),
    ),
  );
}
