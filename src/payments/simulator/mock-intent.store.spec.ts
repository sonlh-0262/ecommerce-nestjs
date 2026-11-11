import Redis from 'ioredis';

import { MockIntentStatus } from './enums/mock-intent-status.enum';
import { MockIntent } from './interfaces/mock-intent.interface';
import { MockIntentStore } from './mock-intent.store';
import { MOCK_INTENT_TTL_SECONDS } from './payment-simulator.constants';

describe('MockIntentStore', () => {
  const INTENT: MockIntent = {
    id: 'mock_pi_1',
    clientSecret: 'mock_pi_1_secret_1',
    amount: 330000,
    currency: 'VND',
    orderCode: 'ORD-20261110-0001',
    status: MockIntentStatus.RequiresPaymentMethod,
    card: null,
    failure: null,
    refundId: null,
  };

  const redis = { get: jest.fn(), set: jest.fn() };
  const store = new MockIntentStore(redis as unknown as Redis);

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('keeps an intent for a day under its own key', async () => {
    redis.set.mockResolvedValue('OK');

    await expect(store.save(INTENT)).resolves.toBe(INTENT);
    expect(redis.set).toHaveBeenCalledWith(
      'payments:mock-intent:mock_pi_1',
      JSON.stringify(INTENT),
      'EX',
      MOCK_INTENT_TTL_SECONDS,
    );
  });

  it('reads an intent back', async () => {
    redis.get.mockResolvedValue(JSON.stringify(INTENT));

    await expect(store.find('mock_pi_1')).resolves.toEqual(INTENT);
    expect(redis.get).toHaveBeenCalledWith('payments:mock-intent:mock_pi_1');
  });

  it('returns null for an unknown or expired intent', async () => {
    redis.get.mockResolvedValue(null);

    await expect(store.find('mock_pi_2')).resolves.toBeNull();
  });

  it('times out instead of hanging when Redis does not answer', async () => {
    jest.useFakeTimers();
    redis.get.mockReturnValue(new Promise(() => undefined));

    const pending = store.find('mock_pi_1');

    jest.advanceTimersByTime(1000);

    await expect(pending).rejects.toThrow('timeout');
    jest.useRealTimers();
  });
});
