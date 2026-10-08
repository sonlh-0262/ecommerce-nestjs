import { withTimeout } from './with-timeout';

describe('withTimeout', () => {
  it('resolves with the value of a promise that settles in time', async () => {
    await expect(withTimeout(Promise.resolve('PONG'), 50)).resolves.toBe(
      'PONG',
    );
  });

  it('passes a rejection through', async () => {
    await expect(
      withTimeout(Promise.reject(new Error('refused')), 50),
    ).rejects.toThrow('refused');
  });

  it('rejects once the time is up', async () => {
    await expect(withTimeout(new Promise(() => undefined), 10)).rejects.toThrow(
      'timeout of 10ms exceeded',
    );
  });

  it('uses the message it is given', async () => {
    await expect(
      withTimeout(new Promise(() => undefined), 10, 'queue unreachable'),
    ).rejects.toThrow('queue unreachable');
  });
});
