import { createHash } from 'crypto';

import { trackByBearerToken } from './bearer-token.tracker';

describe('trackByBearerToken', () => {
  const IP = '203.0.113.7';
  const HEADER = 'Bearer signed.jwt.token';

  it('keys the request by a hash of the token, never the token itself', () => {
    const key = trackByBearerToken({
      ip: IP,
      headers: { authorization: HEADER },
    });

    expect(key).toBe(
      `token:${createHash('sha256').update(HEADER).digest('hex')}`,
    );
    expect(key).not.toContain('signed.jwt.token');
  });

  it('gives the same token the same bucket from any address', () => {
    expect(
      trackByBearerToken({ ip: IP, headers: { authorization: HEADER } }),
    ).toBe(
      trackByBearerToken({
        ip: '198.51.100.1',
        headers: { authorization: HEADER },
      }),
    );
  });

  it('falls back to the IP without a token', () => {
    expect(trackByBearerToken({ ip: IP, headers: {} })).toBe(IP);
  });

  it('copes with a request that has no headers', () => {
    expect(trackByBearerToken({ ip: IP })).toBe(IP);
  });
});
