import { Injectable } from '@nestjs/common';
import { I18nMiddleware } from 'nestjs-i18n';
import { ExtendedError, Namespace, Socket } from 'socket.io';

type Next = (error?: ExtendedError) => void;

@Injectable()
export class SocketLanguageService {
  constructor(private readonly i18nMiddleware: I18nMiddleware) {}

  attach(server: Namespace): void {
    server.use((socket, next) => {
      socket.use((_packet, nextPacket) => this.within(socket, nextPacket));
      this.within(socket, next);
    });
  }

  private within(socket: Socket, next: Next): void {
    const { headers, query } = socket.handshake;

    this.i18nMiddleware.use({ headers, query }, undefined, next).catch(next);
  }
}
