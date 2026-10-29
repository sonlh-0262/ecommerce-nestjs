import { INestApplication } from '@nestjs/common';
import { Server } from 'http';
import { AddressInfo } from 'net';
import { io, Socket } from 'socket.io-client';

import { CHAT_NAMESPACE } from '../../src/chat/chat.constants';
import { SOCKET_EVENT_TIMEOUT_MS } from './test.constants';

export interface ChatSocketOptions {
  token?: string;
  headers?: Record<string, string>;
}

export async function chatSocketUrl(app: INestApplication): Promise<string> {
  await app.listen(0, '127.0.0.1');

  const { port } = (app.getHttpServer() as Server).address() as AddressInfo;

  return `http://127.0.0.1:${port}${CHAT_NAMESPACE}`;
}

export function openChatSocket(
  url: string,
  { token, headers }: ChatSocketOptions = {},
): Socket {
  return io(url, {
    auth: token === undefined ? {} : { token },
    extraHeaders: headers,
    transports: ['websocket'],
    reconnection: false,
    forceNew: true,
  });
}

export function nextEvent<T>(socket: Socket, event: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () =>
        reject(new Error(`No "${event}" within ${SOCKET_EVENT_TIMEOUT_MS} ms`)),
      SOCKET_EVENT_TIMEOUT_MS,
    );

    socket.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

export async function connected(socket: Socket): Promise<Socket> {
  if (!socket.connected) {
    await nextEvent(socket, 'connect');
  }

  return socket;
}
