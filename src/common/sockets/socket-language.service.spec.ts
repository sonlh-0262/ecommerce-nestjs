import { I18nMiddleware } from 'nestjs-i18n';
import { Namespace, Socket } from 'socket.io';

import { SocketLanguageService } from './socket-language.service';

type Middleware = (socket: Socket, next: () => void) => void;
type PacketMiddleware = (packet: unknown[], next: () => void) => void;

describe('SocketLanguageService', () => {
  const HANDSHAKE = {
    headers: { 'x-lang': 'vi' },
    query: { lang: 'vi' },
    auth: { token: 'secret' },
  };

  const i18nMiddlewareMock = {
    use: jest.fn((_req: unknown, _res: unknown, next: () => void) => {
      next();

      return Promise.resolve();
    }),
  };
  const service = new SocketLanguageService(
    i18nMiddlewareMock as unknown as I18nMiddleware,
  );

  const attach = () => {
    const server = { use: jest.fn() };
    const socket = { handshake: HANDSHAKE, use: jest.fn() };

    service.attach(server as unknown as Namespace);

    const [[middleware]] = server.use.mock.calls as [[Middleware]];

    return { socket, middleware };
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('resolves the language from the handshake before the connection', () => {
    const { socket, middleware } = attach();
    const next = jest.fn();

    middleware(socket as unknown as Socket, next);

    expect(i18nMiddlewareMock.use).toHaveBeenCalledWith(
      { headers: HANDSHAKE.headers, query: HANDSHAKE.query },
      undefined,
      next,
    );
    expect(next).toHaveBeenCalled();
  });

  it('resolves it again, on a fresh request, for every packet', () => {
    const { socket, middleware } = attach();

    middleware(socket as unknown as Socket, jest.fn());

    const [[packetMiddleware]] = socket.use.mock.calls as [[PacketMiddleware]];
    const nextPacket = jest.fn();

    packetMiddleware(['message:send', {}], nextPacket);

    expect(i18nMiddlewareMock.use).toHaveBeenCalledTimes(2);
    expect(i18nMiddlewareMock.use.mock.calls[0][0]).not.toBe(
      i18nMiddlewareMock.use.mock.calls[1][0],
    );
    expect(nextPacket).toHaveBeenCalled();
  });

  it('fails the step when the language cannot be resolved', async () => {
    const { socket, middleware } = attach();
    const failure = new Error('resolver failed');
    const next = jest.fn();

    i18nMiddlewareMock.use.mockRejectedValueOnce(failure);
    middleware(socket as unknown as Socket, next);
    await Promise.resolve();

    expect(next).toHaveBeenCalledWith(failure);
  });
});
