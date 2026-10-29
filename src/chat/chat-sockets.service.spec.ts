import { UnauthorizedException } from '@nestjs/common';
import { ExtendedError, Socket } from 'socket.io';

import { AuthService } from '../auth/auth.service';
import { AuthenticatedNamespace } from '../common/sockets/authenticated-socket';
import { SocketErrorsService } from '../common/sockets/socket-errors.service';
import { SocketLanguageService } from '../common/sockets/socket-language.service';
import { UserRole } from '../users/enums/user-role.enum';
import { ChatBroadcastService } from './chat-broadcast.service';
import { ChatSocketsService } from './chat-sockets.service';
import { ADMINS_ROOM } from './chat.constants';

type Middleware = (
  socket: Socket,
  next: (error?: ExtendedError) => void,
) => void;

describe('ChatSocketsService', () => {
  const authMock = { authenticate: jest.fn() };
  const languageMock = { attach: jest.fn() };
  const errorsMock = { connectError: jest.fn() };
  const broadcastMock = { bind: jest.fn() };

  const service = new ChatSocketsService(
    authMock as unknown as AuthService,
    languageMock as unknown as SocketLanguageService,
    errorsMock as unknown as SocketErrorsService,
    broadcastMock as unknown as ChatBroadcastService,
  );

  const attach = () => {
    const server = { use: jest.fn() };

    service.attach(server as unknown as AuthenticatedNamespace);

    const [[admit]] = server.use.mock.calls as [[Middleware]];

    return { server, admit };
  };

  const handshake = (admit: Middleware) => {
    const socket = {
      handshake: { auth: { token: 'jwt' } },
      data: {},
      join: jest.fn(),
      once: jest.fn(),
      disconnect: jest.fn(),
    };

    return new Promise<{ socket: typeof socket; error?: ExtendedError }>(
      (resolve) =>
        admit(socket as unknown as Socket, (error) =>
          resolve({ socket, error }),
        ),
    );
  };

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('resolves the language first, then admits, then broadcasts', () => {
    const { server } = attach();

    expect(languageMock.attach).toHaveBeenCalledWith(server);
    expect(server.use).toHaveBeenCalledTimes(1);
    expect(broadcastMock.bind).toHaveBeenCalledWith(server);
  });

  it.each([
    [UserRole.User, 'user:u1'],
    [UserRole.Admin, ADMINS_ROOM],
  ])('admits a %s and joins them to %s', async (role, room) => {
    const authenticated = { user: { id: 'u1', role }, jti: 'j', expiresAt: 1 };

    authMock.authenticate.mockResolvedValue(authenticated);

    const { socket, error } = await handshake(attach().admit);

    expect(error).toBeUndefined();
    expect(authMock.authenticate).toHaveBeenCalledWith('jwt');
    expect(socket.data).toEqual({ user: authenticated });
    expect(socket.join).toHaveBeenCalledWith(room);
  });

  it('drops the socket when its token expires, unless it left first', async () => {
    jest.useFakeTimers({ now: new Date('2026-10-29T08:00:00.000Z') });

    const expiresAt = Date.now() / 1000 + 60;

    authMock.authenticate.mockResolvedValue({
      user: { id: 'u1', role: UserRole.User },
      jti: 'j',
      expiresAt,
    });

    const { socket } = await handshake(attach().admit);

    jest.advanceTimersByTime(59_999);
    expect(socket.disconnect).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(socket.disconnect).toHaveBeenCalledWith(true);

    const [[event, onDisconnect]] = socket.once.mock.calls as [
      [string, () => void],
    ];

    expect(event).toBe('disconnect');
    expect(() => onDisconnect()).not.toThrow();
  });

  it('forgets the expiry timer of a socket that disconnected', async () => {
    jest.useFakeTimers();
    authMock.authenticate.mockResolvedValue({
      user: { id: 'u1', role: UserRole.User },
      jti: 'j',
      expiresAt: Date.now() / 1000 + 60,
    });

    const { socket } = await handshake(attach().admit);
    const [[, onDisconnect]] = socket.once.mock.calls as [[string, () => void]];

    onDisconnect();
    jest.advanceTimersByTime(120_000);

    expect(socket.disconnect).not.toHaveBeenCalled();
  });

  it('refuses the connection of a bad token', async () => {
    const rejection = new UnauthorizedException('auth.UNAUTHORIZED');
    const connectError = Object.assign(new Error('auth.UNAUTHORIZED'), {
      data: { code: 'UNAUTHORIZED', message: 'auth.UNAUTHORIZED' },
    });

    authMock.authenticate.mockRejectedValue(rejection);
    errorsMock.connectError.mockReturnValue(connectError);

    const { socket, error } = await handshake(attach().admit);

    expect(errorsMock.connectError).toHaveBeenCalledWith(rejection);
    expect(error).toBe(connectError);
    expect(socket.join).not.toHaveBeenCalled();
    expect(socket.data).toEqual({});
  });
});
