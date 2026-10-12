import { Logger } from '@nestjs/common';
import Redis from 'ioredis';

import { CACHE_RESOURCES, generationKey } from '../common/constants/cache-keys';
import { CACHE_COMMAND_TIMEOUT_MS } from './cache.constants';
import { CacheService } from './cache.service';

describe('CacheService', () => {
  const RESOURCE = CACHE_RESOURCES.categories;
  const VARIANT = ['list', 20, 0];
  const GENERATION_KEY = generationKey(RESOURCE);

  let service: CacheService;
  let logWarn: jest.SpyInstance;

  const redisMock = { get: jest.fn(), set: jest.fn(), incr: jest.fn() };
  const entries = new Map<string, string>();

  const getOrSet = (factory: () => Promise<unknown>) =>
    service.getOrSet(RESOURCE, VARIANT, 60, factory);

  beforeEach(() => {
    service = new CacheService(redisMock as unknown as Redis);
    logWarn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);

    entries.clear();
    redisMock.get.mockImplementation((key: string) =>
      Promise.resolve(entries.get(key) ?? null),
    );
    redisMock.set.mockImplementation((key: string, value: string) => {
      entries.set(key, value);

      return Promise.resolve('OK');
    });
    redisMock.incr.mockImplementation((key: string) => {
      const next = Number(entries.get(key) ?? 0) + 1;
      entries.set(key, String(next));

      return Promise.resolve(next);
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    jest.resetAllMocks();
  });

  describe('getOrSet', () => {
    it('calls the factory on a miss and stores what it returns', async () => {
      const factory = jest.fn().mockResolvedValue({ id: 1 });

      await expect(getOrSet(factory)).resolves.toEqual({ id: 1 });

      expect(factory).toHaveBeenCalledTimes(1);
      expect(redisMock.set).toHaveBeenCalledWith(
        'ecom:categories:v0:list:20:0',
        JSON.stringify({ id: 1 }),
        'EX',
        60,
      );
    });

    it('answers from the cache on a hit without calling the factory', async () => {
      await getOrSet(() => Promise.resolve({ id: 1 }));
      const factory = jest.fn();

      await expect(getOrSet(factory)).resolves.toEqual({ id: 1 });

      expect(factory).not.toHaveBeenCalled();
    });

    it('stores under the current generation of the resource', async () => {
      entries.set(GENERATION_KEY, '7');

      await getOrSet(() => Promise.resolve(1));

      expect(entries.has('ecom:categories:v7:list:20:0')).toBe(true);
    });

    it('serves the factory without caching when the generation is unreadable', async () => {
      redisMock.get.mockRejectedValue(new Error('connection refused'));

      await expect(getOrSet(() => Promise.resolve('fresh'))).resolves.toBe(
        'fresh',
      );

      expect(redisMock.set).not.toHaveBeenCalled();
      expect(logWarn).toHaveBeenCalledTimes(1);
    });

    it('still answers when the entry cannot be read or written', async () => {
      redisMock.get
        .mockResolvedValueOnce('0')
        .mockRejectedValueOnce(new Error('connection refused'));
      redisMock.set.mockRejectedValue(new Error('connection refused'));

      await expect(getOrSet(() => Promise.resolve(['db']))).resolves.toEqual([
        'db',
      ]);

      expect(logWarn).toHaveBeenCalledTimes(2);
    });

    it('gives up on Redis commands that hang', async () => {
      jest.useFakeTimers();
      redisMock.get.mockReturnValue(new Promise(() => undefined));

      const pending = getOrSet(() => Promise.resolve(7));

      await jest.advanceTimersByTimeAsync(CACHE_COMMAND_TIMEOUT_MS);

      await expect(pending).resolves.toBe(7);
    });

    it('treats an entry that is not valid JSON as a miss', async () => {
      entries.set('ecom:categories:v0:list:20:0', '{not json');

      await expect(getOrSet(() => Promise.resolve('fresh'))).resolves.toBe(
        'fresh',
      );
    });

    it('lets a factory failure through without caching', async () => {
      await expect(
        getOrSet(() => Promise.reject(new Error('db down'))),
      ).rejects.toThrow('db down');

      expect(redisMock.set).not.toHaveBeenCalled();
    });
  });

  describe('invalidate', () => {
    it('makes every cached entry of the resource unreachable', async () => {
      await getOrSet(() => Promise.resolve('old'));

      await service.invalidate(RESOURCE);

      await expect(getOrSet(() => Promise.resolve('new'))).resolves.toBe('new');
    });

    it('keeps a value loaded before the change out of the new generation', async () => {
      let release: (value: string) => void = () => undefined;
      let loading: () => void = () => undefined;
      const started = new Promise<void>((resolve) => (loading = resolve));
      const slowRead = getOrSet(() => {
        loading();

        return new Promise<string>((resolve) => (release = resolve));
      });

      await started;
      await service.invalidate(RESOURCE);
      release('stale');
      await slowRead;

      await expect(getOrSet(() => Promise.resolve('fresh'))).resolves.toBe(
        'fresh',
      );
    });

    it('bumps every resource it is given, even after one fails', async () => {
      redisMock.incr.mockRejectedValueOnce(new Error('connection refused'));

      await expect(
        service.invalidate(
          CACHE_RESOURCES.categories,
          CACHE_RESOURCES.products,
        ),
      ).resolves.toBeUndefined();

      expect(redisMock.incr).toHaveBeenCalledWith(
        generationKey(CACHE_RESOURCES.products),
      );
      expect(logWarn).toHaveBeenCalledTimes(1);
    });
  });
});
