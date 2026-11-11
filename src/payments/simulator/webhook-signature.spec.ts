import { isValidWebhookSignature, signWebhook } from './webhook-signature';

describe('webhook signature', () => {
  const SECRET = 'mock-payment-webhook-secret';
  const PAYLOAD = '{"id":"mock_evt_1"}';
  const NOW = 1_793_851_200;
  const TOLERANCE = 300;

  const check = (header: string, now = NOW, secret = SECRET) =>
    isValidWebhookSignature(PAYLOAD, header, secret, now, TOLERANCE);

  it('signs in the t=<seconds>,v1=<hex hmac> format', () => {
    expect(signWebhook(PAYLOAD, SECRET, NOW)).toMatch(
      new RegExp(`^t=${NOW},v1=[0-9a-f]{64}$`),
    );
  });

  it('accepts its own signature', () => {
    expect(check(signWebhook(PAYLOAD, SECRET, NOW))).toBe(true);
  });

  it('accepts a signature within the tolerance', () => {
    expect(check(signWebhook(PAYLOAD, SECRET, NOW), NOW + TOLERANCE)).toBe(
      true,
    );
  });

  it('rejects a replay older than the tolerance', () => {
    expect(check(signWebhook(PAYLOAD, SECRET, NOW), NOW + TOLERANCE + 1)).toBe(
      false,
    );
  });

  it('rejects another secret', () => {
    expect(check(signWebhook(PAYLOAD, 'another-secret', NOW))).toBe(false);
  });

  it('rejects a tampered payload', () => {
    expect(
      isValidWebhookSignature(
        '{"id":"mock_evt_2"}',
        signWebhook(PAYLOAD, SECRET, NOW),
        SECRET,
        NOW,
        TOLERANCE,
      ),
    ).toBe(false);
  });

  it.each([
    '',
    'garbage',
    `t=${NOW}`,
    'v1=abc',
    `t=soon,v1=abc`,
    `t=${NOW},v1=abc`,
  ])('rejects the malformed header %p', (header) => {
    expect(check(header)).toBe(false);
  });
});
