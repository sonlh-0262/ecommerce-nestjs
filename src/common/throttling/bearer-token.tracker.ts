import { normalizeIp } from '@nestjs/throttler';
import { createHash } from 'crypto';

interface RequestWithHeaders {
  ip?: unknown;
  headers?: { authorization?: unknown };
}

export function trackByBearerToken(req: Record<string, unknown>): string {
  const { ip, headers } = req as RequestWithHeaders;
  const authorization = headers?.authorization;

  return typeof authorization === 'string'
    ? `token:${createHash('sha256').update(authorization).digest('hex')}`
    : normalizeIp(typeof ip === 'string' ? ip : '');
}
