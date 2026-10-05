import { trackByIpAndEmail } from './ip-and-email.tracker';

describe('trackByIpAndEmail', () => {
  const IP = '203.0.113.7';

  it('keys a flat body by IP and normalised email', () => {
    expect(
      trackByIpAndEmail({ ip: IP, body: { email: '  Son@Example.com ' } }),
    ).toBe(`${IP}:son@example.com`);
  });

  it('reads the email from the user envelope', () => {
    expect(
      trackByIpAndEmail({
        ip: IP,
        body: { user: { email: 'son@example.com' } },
      }),
    ).toBe(`${IP}:son@example.com`);
  });

  it('falls back to the IP alone without an email', () => {
    expect(trackByIpAndEmail({ ip: IP, body: {} })).toBe(IP);
  });

  it('ignores an email that is not a string', () => {
    expect(trackByIpAndEmail({ ip: IP, body: { email: ['a', 'b'] } })).toBe(IP);
  });

  it('copes with a request that has no body', () => {
    expect(trackByIpAndEmail({ ip: IP })).toBe(IP);
  });
});
