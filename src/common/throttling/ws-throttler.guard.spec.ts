import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ThrottlerException } from '@nestjs/throttler';

import { trackBySocketUser } from './socket-user.tracker';
import { WsThrottlerGuard } from './ws-throttler.guard';

describe('WsThrottlerGuard', () => {
  const storageMock = { increment: jest.fn() };
  const getTracker = jest.fn(trackBySocketUser);

  const guard = new WsThrottlerGuard(
    { throttlers: [{ name: 'default', limit: 1, ttl: 60_000, getTracker }] },
    storageMock,
    new Reflector(),
  );

  const socket = { data: { user: { user: { id: 'u1' } } } };
  const handler = () => undefined;
  class Gateway {}

  const context = {
    getHandler: () => handler,
    getClass: () => Gateway,
    getType: () => 'ws',
    switchToWs: () => ({ getClient: () => socket }),
  } as unknown as ExecutionContext;

  const hits = (isBlocked: boolean) => ({
    totalHits: isBlocked ? 2 : 1,
    timeToExpire: 60,
    isBlocked,
    timeToBlockExpire: isBlocked ? 60 : 0,
  });

  beforeAll(async () => {
    await guard.onModuleInit();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('counts socket events per account, without HTTP headers', async () => {
    storageMock.increment.mockResolvedValue(hits(false));

    await expect(guard.canActivate(context)).resolves.toBe(true);

    expect(getTracker).toHaveBeenCalledWith(socket.data, context);
    expect(getTracker).toHaveReturnedWith('user:u1');
  });

  it('refuses an event past the limit with 429', async () => {
    storageMock.increment.mockResolvedValue(hits(true));

    await expect(guard.canActivate(context)).rejects.toThrow(
      ThrottlerException,
    );
  });
});
