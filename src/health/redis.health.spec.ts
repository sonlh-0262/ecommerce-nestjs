import { HealthIndicatorService } from '@nestjs/terminus';
import Redis from 'ioredis';

import { RedisHealthIndicator } from './redis.health';

describe('RedisHealthIndicator', () => {
  const redisMock = { ping: jest.fn() };

  const indicator = new RedisHealthIndicator(
    redisMock as unknown as Redis,
    new HealthIndicatorService(),
  );

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('is up when PING answers PONG', async () => {
    redisMock.ping.mockResolvedValue('PONG');

    await expect(indicator.pingCheck('redis')).resolves.toEqual({
      redis: { status: 'up' },
    });
  });

  it('is down when PING fails, without exposing why', async () => {
    redisMock.ping.mockRejectedValue(new Error('connection refused'));

    await expect(indicator.pingCheck('redis')).resolves.toEqual({
      redis: { status: 'down' },
    });
  });

  it('is down when PING does not answer in time', async () => {
    redisMock.ping.mockReturnValue(new Promise(() => undefined));

    await expect(indicator.pingCheck('redis', 10)).resolves.toEqual({
      redis: { status: 'down' },
    });
  });
});
