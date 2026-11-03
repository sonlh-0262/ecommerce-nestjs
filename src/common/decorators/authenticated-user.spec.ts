import { ExecutionContext } from '@nestjs/common';

import { authenticatedUser } from './authenticated-user';

describe('authenticatedUser', () => {
  const AUTHENTICATED = { user: { id: 'user-id' }, jti: 'j', expiresAt: 1 };

  it('reads the account Passport put on an HTTP request', () => {
    const context = {
      getType: () => 'http',
      switchToHttp: () => ({ getRequest: () => ({ user: AUTHENTICATED }) }),
    } as unknown as ExecutionContext;

    expect(authenticatedUser(context)).toBe(AUTHENTICATED);
  });

  it('reads the account JwtAuthGuard put on a socket', () => {
    const context = {
      getType: () => 'ws',
      switchToWs: () => ({
        getClient: () => ({ data: { user: AUTHENTICATED } }),
      }),
    } as unknown as ExecutionContext;

    expect(authenticatedUser(context)).toBe(AUTHENTICATED);
  });

  it('fails loudly on a route that skipped authentication', () => {
    const context = {
      getType: () => 'http',
      switchToHttp: () => ({ getRequest: () => ({}) }),
    } as unknown as ExecutionContext;

    expect(() => authenticatedUser(context)).toThrow(/No authenticated user/);
  });
});
