import { trackBySocketUser } from './socket-user.tracker';

describe('trackBySocketUser', () => {
  it('tracks a socket by the account it signed in as', () => {
    expect(trackBySocketUser({ user: { user: { id: 'u1' } } })).toBe('user:u1');
  });

  it('pools sockets that carry no account', () => {
    expect(trackBySocketUser({})).toBe('user:anonymous');
  });
});
