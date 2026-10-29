import { SocketData } from '../sockets/authenticated-socket';

export function trackBySocketUser(req: Record<string, unknown>): string {
  return `user:${(req as SocketData).user?.user.id ?? 'anonymous'}`;
}
