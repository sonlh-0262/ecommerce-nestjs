import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';

import { AuthenticatedSocket } from '../sockets/authenticated-socket';
import { SocketErrorsService } from '../sockets/socket-errors.service';

@Catch()
export class WsExceptionsFilter implements ExceptionFilter {
  constructor(private readonly errors: SocketErrorsService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    this.errors.reject(
      host.switchToWs().getClient<AuthenticatedSocket>(),
      exception,
    );
  }
}
