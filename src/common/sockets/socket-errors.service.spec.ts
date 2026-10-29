import {
  ForbiddenException,
  HttpException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { I18nService, I18nValidationException } from 'nestjs-i18n';

import { AuthenticatedSocket } from './authenticated-socket';
import { SocketErrorsService } from './socket-errors.service';
import { SOCKET_ERROR_EVENT } from './sockets.constants';

describe('SocketErrorsService', () => {
  const i18nMock = {
    t: jest.fn((key: string) => key),
    translate: jest.fn((key: string) => key),
  };
  const service = new SocketErrorsService(i18nMock as unknown as I18nService);

  const socketMock = { emit: jest.fn(), disconnect: jest.fn() };
  const socket = socketMock as unknown as AuthenticatedSocket;

  let logError: jest.SpyInstance;

  beforeEach(() => {
    logError = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('reports a client error by its status name and keeps the socket open', () => {
    service.reject(
      socket,
      new NotFoundException('chat.CONVERSATION_NOT_FOUND'),
    );

    expect(socketMock.emit).toHaveBeenCalledWith(SOCKET_ERROR_EVENT, {
      code: 'NOT_FOUND',
      message: 'chat.CONVERSATION_NOT_FOUND',
    });
    expect(socketMock.disconnect).not.toHaveBeenCalled();
  });

  it('names a status the enum does not know by its number', () => {
    service.reject(socket, new HttpException('Teapot-ish', 499));

    expect(socketMock.emit).toHaveBeenCalledWith(SOCKET_ERROR_EVENT, {
      code: '499',
      message: 'Teapot-ish',
    });
  });

  it.each([
    new UnauthorizedException('auth.TOKEN_REVOKED'),
    new ForbiddenException('auth.ACCOUNT_INACTIVE'),
  ])('closes the socket on %p', (exception) => {
    service.reject(socket, exception);

    expect(socketMock.disconnect).toHaveBeenCalledWith(true);
  });

  it('translates every validation failure into one message', () => {
    service.reject(
      socket,
      new I18nValidationException([
        {
          property: 'content',
          children: [],
          constraints: {
            isLength: 'validation.LENGTH|{"constraints":[1,2000]}',
          },
        },
        {
          property: 'conversationId',
          children: [],
          constraints: { isUuid: 'validation.IS_UUID' },
        },
      ]),
    );

    expect(socketMock.emit).toHaveBeenCalledWith(SOCKET_ERROR_EVENT, {
      code: 'BAD_REQUEST',
      message: 'validation.LENGTH; validation.IS_UUID',
    });
    expect(socketMock.disconnect).not.toHaveBeenCalled();
  });

  it('turns a refused handshake into a connect error carrying the same payload', () => {
    const error = service.connectError(
      new UnauthorizedException('auth.UNAUTHORIZED'),
    );

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('auth.UNAUTHORIZED');
    expect(error.data).toEqual({
      code: 'UNAUTHORIZED',
      message: 'auth.UNAUTHORIZED',
    });
    expect(socketMock.emit).not.toHaveBeenCalled();
  });

  it.each([
    ['a server error', new ServiceUnavailableException('redis down')],
    ['an unknown failure', new Error('boom')],
    ['a thrown string', 'boom'],
  ])('hides the detail of %s', (_case, exception) => {
    service.reject(socket, exception);

    expect(socketMock.emit).toHaveBeenCalledWith(SOCKET_ERROR_EVENT, {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'common.INTERNAL_ERROR',
    });
    expect(logError).toHaveBeenCalled();
    expect(socketMock.disconnect).not.toHaveBeenCalled();
  });
});
