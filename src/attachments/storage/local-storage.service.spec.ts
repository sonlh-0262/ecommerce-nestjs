import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { access, mkdtemp, readFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import * as path from 'path';

import { StorageConfig } from '../../config/storage.config';
import { buildStoragePath, LocalStorageService } from './local-storage.service';

describe('buildStoragePath', () => {
  it('buckets the file by year and month', () => {
    expect(
      buildStoragePath(new Date('2026-03-05T10:00:00Z'), 'abc', 'png'),
    ).toBe('2026/03/abc.png');
  });

  it('uses UTC, so the bucket does not depend on the server time zone', () => {
    expect(
      buildStoragePath(new Date('2026-03-31T20:00:00Z'), 'abc', 'jpg'),
    ).toBe('2026/03/abc.jpg');
  });
});

describe('LocalStorageService', () => {
  let root: string;
  let storage: LocalStorageService;
  let logWarn: jest.SpyInstance;

  const build = (configuredRoot: string): LocalStorageService => {
    const config: StorageConfig = { root: configuredRoot };

    return new LocalStorageService({
      getOrThrow: () => config,
    } as unknown as ConfigService);
  };

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), 'storage-'));
    storage = build(root);
    logWarn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await rm(root, { recursive: true, force: true });
  });

  describe('save', () => {
    it('writes the bytes, creating any missing directory', async () => {
      await storage.save('2026/03/a.png', Buffer.from('contents'));

      const written = await readFile(path.join(root, '2026', '03', 'a.png'));

      expect(written.toString()).toBe('contents');
    });
  });

  describe('resolve', () => {
    it('resolves a path inside the root', () => {
      expect(storage.resolve('2026/03/a.png')).toBe(
        path.join(root, '2026', '03', 'a.png'),
      );
    });

    it('refuses a path that climbs out of the root', () => {
      expect(() => storage.resolve('../../etc/passwd')).toThrow(
        /outside the storage root/,
      );
    });

    it('refuses an absolute path', () => {
      const absolute = path.join(path.parse(root).root, 'etc', 'passwd');

      expect(() => storage.resolve(absolute)).toThrow(
        /outside the storage root/,
      );
    });

    it('refuses a sibling directory that merely shares the prefix', () => {
      const sibling = path.join('..', `${path.basename(root)}-evil`, 'a.png');

      expect(() => storage.resolve(sibling)).toThrow(
        /outside the storage root/,
      );
    });

    it('refuses the root itself, which is not a file', () => {
      expect(() => storage.resolve('.')).toThrow(/outside the storage root/);
    });
  });

  describe('openReadStream', () => {
    it('streams a file that exists', async () => {
      await storage.save('2026/03/a.png', Buffer.from('opened'));

      const stream = await storage.openReadStream('2026/03/a.png');
      const chunks: Buffer[] = [];
      for await (const chunk of stream!) {
        chunks.push(chunk as Buffer);
      }

      expect(Buffer.concat(chunks).toString()).toBe('opened');
    });

    it('is null for a file that is missing, instead of failing later', async () => {
      await expect(
        storage.openReadStream('2026/03/missing.png'),
      ).resolves.toBeNull();
    });

    it('is null for a directory', async () => {
      await storage.save('2026/03/a.png', Buffer.from('x'));

      await expect(storage.openReadStream('2026/03')).resolves.toBeNull();
    });

    it('is null for a path outside the root', async () => {
      await expect(
        storage.openReadStream('../../etc/passwd'),
      ).resolves.toBeNull();
    });
  });

  describe('remove', () => {
    it('deletes the file', async () => {
      await storage.save('2026/03/a.png', Buffer.from('x'));
      await storage.remove('2026/03/a.png');

      await expect(
        access(path.join(root, '2026', '03', 'a.png')),
      ).rejects.toThrow();
    });

    it('is silent about a file that is already gone', async () => {
      await expect(
        storage.remove('2026/03/missing.png'),
      ).resolves.toBeUndefined();
    });

    it('logs rather than throws for a rejected path', async () => {
      await expect(storage.remove('../../etc/passwd')).resolves.toBeUndefined();

      expect(logWarn).toHaveBeenCalled();
    });
  });

  it('resolves a relative root against the working directory', () => {
    expect(build('storage').resolve('2026/03/a.png')).toBe(
      path.join(process.cwd(), 'storage', '2026', '03', 'a.png'),
    );
  });
});
