import { DefaultEventsMap, Namespace, Socket } from 'socket.io';

import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';

export interface SocketData {
  user?: AuthenticatedUser;
}

export type AuthenticatedSocket = Socket<
  DefaultEventsMap,
  DefaultEventsMap,
  DefaultEventsMap,
  SocketData
>;

export type AuthenticatedNamespace = Namespace<
  DefaultEventsMap,
  DefaultEventsMap,
  DefaultEventsMap,
  SocketData
>;

export function socketToken(socket: AuthenticatedSocket): unknown {
  return (socket.handshake.auth as { token?: unknown }).token;
}
