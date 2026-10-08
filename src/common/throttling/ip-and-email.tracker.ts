import { normalizeIp } from '@nestjs/throttler';

interface EmailBody {
  email?: unknown;
  user?: { email?: unknown };
}

export function trackByIpAndEmail(req: Record<string, unknown>): string {
  const ip = normalizeIp(typeof req.ip === 'string' ? req.ip : '');
  const body = (req.body ?? {}) as EmailBody;
  const email = body.user?.email ?? body.email;

  return typeof email === 'string' ? `${ip}:${email.trim().toLowerCase()}` : ip;
}
