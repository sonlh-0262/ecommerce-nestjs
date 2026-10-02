import Redis from 'ioredis';

import {
  MILLISECONDS_PER_SECOND,
  TOKEN_DENYLIST_KEY_PREFIX,
  TOKEN_DENYLIST_VALUE,
} from './auth.constants';
import { TokenBlacklistService } from './token-blacklist.service';

describe('TokenBlacklistService', () => {
  const NOW_SECONDS = 1_790_000_000;
  const JTI = 'token-id';
  const KEY = `${TOKEN_DENYLIST_KEY_PREFIX}${JTI}`;

  let service: TokenBlacklistService;

  const redisMock = { set: jest.fn(), exists: jest.fn() };

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(NOW_SECONDS * MILLISECONDS_PER_SECOND);
    service = new TokenBlacklistService(redisMock as unknown as Redis);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  describe('revoke', () => {
    it('stores the token id for the rest of its lifetime', async () => {
      await expect(service.revoke(JTI, NOW_SECONDS + 60)).resolves.toBe(true);

      expect(redisMock.set).toHaveBeenCalledWith(
        KEY,
        TOKEN_DENYLIST_VALUE,
        'EX',
        60,
      );
    });

    it('does nothing for a token that has already expired', async () => {
      // Writing a key with a non-positive TTL is an error in Redis, and the
      // token is refused by its own `exp` anyway.
      await expect(service.revoke(JTI, NOW_SECONDS - 1)).resolves.toBe(false);

      expect(redisMock.set).not.toHaveBeenCalled();
    });

    it('does nothing for a token expiring exactly now', async () => {
      await expect(service.revoke(JTI, NOW_SECONDS)).resolves.toBe(false);

      expect(redisMock.set).not.toHaveBeenCalled();
    });
  });

  describe('isRevoked', () => {
    it('reports a revoked token', async () => {
      redisMock.exists.mockResolvedValue(1);

      await expect(service.isRevoked(JTI)).resolves.toBe(true);
      expect(redisMock.exists).toHaveBeenCalledWith(KEY);
    });

    it('reports a token that was never revoked', async () => {
      redisMock.exists.mockResolvedValue(0);

      await expect(service.isRevoked(JTI)).resolves.toBe(false);
    });
  });
});
