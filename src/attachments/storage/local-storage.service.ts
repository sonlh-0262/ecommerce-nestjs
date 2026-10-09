import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ReadStream } from 'fs';
import { mkdir, open, rm, writeFile } from 'fs/promises';
import * as path from 'path';

import { STORAGE_CONFIG_KEY, StorageConfig } from '../../config/storage.config';

export function buildStoragePath(
  at: Date,
  id: string,
  extension: string,
): string {
  const year = String(at.getUTCFullYear());
  const month = String(at.getUTCMonth() + 1).padStart(2, '0');

  return `${year}/${month}/${id}.${extension}`;
}

@Injectable()
export class LocalStorageService {
  private readonly logger = new Logger(LocalStorageService.name);
  private readonly root: string;

  constructor(configService: ConfigService) {
    this.root = path.resolve(
      configService.getOrThrow<StorageConfig>(STORAGE_CONFIG_KEY).root,
    );
  }

  resolve(storagePath: string): string {
    const absolute = path.resolve(this.root, storagePath);

    if (!absolute.startsWith(this.root + path.sep)) {
      throw new Error(
        `Refusing to access "${storagePath}" outside the storage root`,
      );
    }

    return absolute;
  }

  async save(storagePath: string, contents: Buffer): Promise<void> {
    const absolute = this.resolve(storagePath);

    await mkdir(path.dirname(absolute), { recursive: true });
    await writeFile(absolute, contents);
  }

  async openReadStream(storagePath: string): Promise<ReadStream | null> {
    let absolute: string;

    try {
      absolute = this.resolve(storagePath);
    } catch {
      return null;
    }

    const handle = await open(absolute, 'r').catch(
      (error: NodeJS.ErrnoException) => {
        if (error.code === 'ENOENT') {
          return null;
        }

        throw error;
      },
    );

    if (!handle) {
      return null;
    }

    try {
      if ((await handle.stat()).isFile()) {
        return handle.createReadStream();
      }
    } catch (error) {
      await handle.close();

      throw error;
    }

    await handle.close();

    return null;
  }

  async remove(storagePath: string): Promise<void> {
    try {
      await rm(this.resolve(storagePath), { force: true });
    } catch (error) {
      this.logger.warn(
        `Could not delete "${storagePath}": ${(error as Error).message}`,
      );
    }
  }
}
