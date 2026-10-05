import { Logger } from '@nestjs/common';

import { FailOpenThrottlerStorage } from './fail-open-throttler.storage';

describe('FailOpenThrottlerStorage', () => {
  const record = {
    totalHits: 3,
    timeToExpire: 42,
    isBlocked: false,
    timeToBlockExpire: 0,
  };
  const innerMock = { increment: jest.fn() };
  const storage = new FailOpenThrottlerStorage(innerMock, 10);

  const increment = () =>
    storage.increment('ip', 60_000, 100, 60_000, 'default');

  let logWarn: jest.SpyInstance;

  beforeEach(() => {
    logWarn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.resetAllMocks();
  });

  it('passes the counter through while Redis answers', async () => {
    innerMock.increment.mockResolvedValue(record);

    await expect(increment()).resolves.toBe(record);
    expect(innerMock.increment).toHaveBeenCalledWith(
      'ip',
      60_000,
      100,
      60_000,
      'default',
    );
  });

  it('lets the request through when Redis fails', async () => {
    innerMock.increment.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(increment()).resolves.toMatchObject({
      totalHits: 0,
      isBlocked: false,
    });
    expect(logWarn).toHaveBeenCalled();
  });

  it('lets the request through when Redis does not answer in time', async () => {
    innerMock.increment.mockReturnValue(new Promise(() => undefined));

    await expect(increment()).resolves.toMatchObject({ isBlocked: false });
  });

  it('still blocks a client Redis says is over the limit', async () => {
    innerMock.increment.mockResolvedValue({ ...record, isBlocked: true });

    await expect(increment()).resolves.toMatchObject({ isBlocked: true });
  });
});
