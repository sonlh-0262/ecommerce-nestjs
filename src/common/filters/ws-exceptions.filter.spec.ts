import { ArgumentsHost, NotFoundException } from '@nestjs/common';

import { SocketErrorsService } from '../sockets/socket-errors.service';
import { WsExceptionsFilter } from './ws-exceptions.filter';

describe('WsExceptionsFilter', () => {
  it('hands the exception and the socket that caused it to SocketErrorsService', () => {
    const errorsMock = { reject: jest.fn() };
    const filter = new WsExceptionsFilter(
      errorsMock as unknown as SocketErrorsService,
    );
    const socket = { id: 'socket-id' };
    const exception = new NotFoundException();

    filter.catch(exception, {
      switchToWs: () => ({ getClient: () => socket }),
    } as unknown as ArgumentsHost);

    expect(errorsMock.reject).toHaveBeenCalledWith(socket, exception);
  });
});
