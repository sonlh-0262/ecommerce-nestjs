import { Logger } from '@nestjs/common';
import Redis from 'ioredis';

import { RedisLockService } from './redis-lock.service';
import {
  LOCK_COMMAND_TIMEOUT_MS,
  RELEASE_LOCK_SCRIPT,
} from './redis.constants';

describe('RedisLockService', () => {
  const NAME = 'orders-auto-cancel';
  const KEY = `lock:${NAME}`;
  const TTL = 120;

  let service: RedisLockService;
  let logWarn: jest.SpyInstance;

  const redisMock = { set: jest.fn(), eval: jest.fn() };
  const holders = new Map<string, string>();

  beforeEach(() => {
    service = new RedisLockService(redisMock as unknown as Redis);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    logWarn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);

    holders.clear();
    redisMock.set.mockImplementation((key: string, token: string) => {
      if (holders.has(key)) {
        return Promise.resolve(null);
      }

      holders.set(key, token);

      return Promise.resolve('OK');
    });
    redisMock.eval.mockImplementation(
      (_script: string, _keys: number, key: string, token: string) => {
        if (holders.get(key) !== token) {
          return Promise.resolve(0);
        }

        holders.delete(key);

        return Promise.resolve(1);
      },
    );
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    jest.resetAllMocks();
  });

  it('runs the task while holding the lock, then releases it', async () => {
    const task = jest.fn(() => {
      expect(holders.has(KEY)).toBe(true);

      return Promise.resolve();
    });

    await expect(service.runExclusive(NAME, TTL, task)).resolves.toBe(true);

    expect(task).toHaveBeenCalledTimes(1);
    expect(redisMock.set).toHaveBeenCalledWith(
      KEY,
      expect.any(String),
      'EX',
      TTL,
      'NX',
    );
    expect(holders.has(KEY)).toBe(false);
  });

  it('skips a second run while the first one holds the lock', async () => {
    const second = jest.fn();

    await service.runExclusive(NAME, TTL, async () => {
      await expect(service.runExclusive(NAME, TTL, second)).resolves.toBe(
        false,
      );
    });

    expect(second).not.toHaveBeenCalled();
  });

  it('releases the lock when the task throws', async () => {
    await expect(
      service.runExclusive(NAME, TTL, () => Promise.reject(new Error('boom'))),
    ).rejects.toThrow('boom');

    expect(holders.has(KEY)).toBe(false);
  });

  it('releases with the token it acquired, so it never frees a lock it lost', async () => {
    await service.runExclusive(NAME, TTL, () => {
      holders.set(KEY, 'another-instance');

      return Promise.resolve();
    });

    const [[, token]] = redisMock.set.mock.calls as [[string, string]];

    expect(redisMock.eval).toHaveBeenCalledWith(
      RELEASE_LOCK_SCRIPT,
      1,
      KEY,
      token,
    );
    expect(holders.get(KEY)).toBe('another-instance');
  });

  it('does not run the task when Redis cannot be reached', async () => {
    redisMock.set.mockRejectedValue(new Error('connection refused'));
    const task = jest.fn();

    await expect(service.runExclusive(NAME, TTL, task)).resolves.toBe(false);

    expect(task).not.toHaveBeenCalled();
    expect(logWarn).toHaveBeenCalledTimes(1);
  });

  it('gives up on a lock command that hangs', async () => {
    jest.useFakeTimers();
    redisMock.set.mockReturnValue(new Promise(() => undefined));
    const task = jest.fn();

    const pending = service.runExclusive(NAME, TTL, task);

    await jest.advanceTimersByTimeAsync(LOCK_COMMAND_TIMEOUT_MS);

    await expect(pending).resolves.toBe(false);
    expect(task).not.toHaveBeenCalled();
  });

  describe('claim', () => {
    it('takes a name once and keeps it until it expires', async () => {
      await expect(service.claim(NAME, TTL)).resolves.toBe(true);
      await expect(service.claim(NAME, TTL)).resolves.toBe(false);

      expect(redisMock.set).toHaveBeenCalledWith(
        KEY,
        expect.any(String),
        'EX',
        TTL,
        'NX',
      );
      expect(redisMock.eval).not.toHaveBeenCalled();
    });

    it('lets the caller see that Redis could not be reached', async () => {
      redisMock.set.mockRejectedValue(new Error('connection refused'));

      await expect(service.claim(NAME, TTL)).rejects.toThrow(
        'connection refused',
      );
    });
  });

  it('still reports the run when the lock cannot be released', async () => {
    redisMock.eval.mockRejectedValue(new Error('connection reset'));

    await expect(
      service.runExclusive(NAME, TTL, () => Promise.resolve()),
    ).resolves.toBe(true);

    expect(logWarn).toHaveBeenCalledTimes(1);
  });
});
