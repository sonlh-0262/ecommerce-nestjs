import { Injectable } from '@nestjs/common';
import { ExtendedError } from 'socket.io';

import { MILLISECONDS_PER_SECOND } from '../auth/auth.constants';
import { AuthService } from '../auth/auth.service';
import { MAX_TIMER_DELAY_MS } from '../common/constants/time';
import {
  AuthenticatedNamespace,
  AuthenticatedSocket,
  socketToken,
} from '../common/sockets/authenticated-socket';
import { SocketErrorsService } from '../common/sockets/socket-errors.service';
import { SocketLanguageService } from '../common/sockets/socket-language.service';
import { roomOf } from './chat-access';
import { ChatBroadcastService } from './chat-broadcast.service';

@Injectable()
export class ChatSocketsService {
  constructor(
    private readonly auth: AuthService,
    private readonly language: SocketLanguageService,
    private readonly errors: SocketErrorsService,
    private readonly broadcast: ChatBroadcastService,
  ) {}

  attach(server: AuthenticatedNamespace): void {
    this.language.attach(server);
    server.use((socket, next) => this.admit(socket, next));
    this.broadcast.bind(server);
  }

  private admit(
    socket: AuthenticatedSocket,
    next: (error?: ExtendedError) => void,
  ): void {
    this.open(socket).then(
      () => next(),
      (error: unknown) => next(this.errors.connectError(error)),
    );
  }

  private async open(socket: AuthenticatedSocket): Promise<void> {
    const authenticated = await this.auth.authenticate(socketToken(socket));

    socket.data.user = authenticated;
    await socket.join(roomOf(authenticated.user));
    this.closeOnExpiry(socket, authenticated.expiresAt);
  }

  private closeOnExpiry(socket: AuthenticatedSocket, expiresAt: number): void {
    const delay = Math.min(
      expiresAt * MILLISECONDS_PER_SECOND - Date.now(),
      MAX_TIMER_DELAY_MS,
    );
    const timer = setTimeout(() => socket.disconnect(true), delay);

    timer.unref();
    socket.once('disconnect', () => clearTimeout(timer));
  }
}
