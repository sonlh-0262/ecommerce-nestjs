import { createHmac, timingSafeEqual } from 'crypto';

import { WEBHOOK_SIGNATURE_KEYS } from './payment-simulator.constants';

const { timestamp: TIMESTAMP_KEY, signature: SIGNATURE_KEY } =
  WEBHOOK_SIGNATURE_KEYS;

function digest(payload: string, secret: string, timestamp: number): string {
  return createHmac('sha256', secret)
    .update(`${timestamp}.${payload}`)
    .digest('hex');
}

export function signWebhook(
  payload: string,
  secret: string,
  timestamp: number,
): string {
  return `${TIMESTAMP_KEY}=${timestamp},${SIGNATURE_KEY}=${digest(payload, secret, timestamp)}`;
}

export function isValidWebhookSignature(
  payload: string,
  header: string,
  secret: string,
  nowSeconds: number,
  toleranceSeconds: number,
): boolean {
  const parts = new Map(
    header.split(',').map((part) => {
      const [key, ...value] = part.trim().split('=');

      return [key, value.join('=')] as const;
    }),
  );
  const timestamp = Number(parts.get(TIMESTAMP_KEY));
  const signature = parts.get(SIGNATURE_KEY);

  if (!Number.isInteger(timestamp) || !signature) {
    return false;
  }

  if (Math.abs(nowSeconds - timestamp) > toleranceSeconds) {
    return false;
  }

  const expected = Buffer.from(digest(payload, secret, timestamp));
  const received = Buffer.from(signature);

  return (
    expected.length === received.length && timingSafeEqual(expected, received)
  );
}
