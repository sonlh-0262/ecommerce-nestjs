import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { I18nContext, I18nService, I18nValidationException } from 'nestjs-i18n';
import {
  formatI18nErrors,
  mapChildrenToValidationErrors,
} from 'nestjs-i18n/dist/utils';
import { ExtendedError } from 'socket.io';

import { AuthenticatedSocket } from './authenticated-socket';
import { ResolvedSocketError } from './socket-error.interface';
import {
  SOCKET_CLOSING_STATUSES,
  SOCKET_ERROR_EVENT,
  SOCKET_ERROR_SEPARATOR,
} from './sockets.constants';

@Injectable()
export class SocketErrorsService {
  private readonly logger = new Logger(SocketErrorsService.name);

  constructor(private readonly i18n: I18nService) {}

  reject(socket: AuthenticatedSocket, exception: unknown): void {
    const { status, error } = this.resolve(exception);

    socket.emit(SOCKET_ERROR_EVENT, error);

    if (SOCKET_CLOSING_STATUSES.has(status)) {
      socket.disconnect(true);
    }
  }

  connectError(exception: unknown): ExtendedError {
    const { error } = this.resolve(exception);

    return Object.assign(new Error(error.message), { data: error });
  }

  private resolve(exception: unknown): ResolvedSocketError {
    const { status, message } = this.statusAndMessage(exception);

    return {
      status,
      error: { code: HttpStatus[status] ?? String(status), message },
    };
  }

  private statusAndMessage(exception: unknown): {
    status: HttpStatus;
    message: string;
  } {
    if (exception instanceof I18nValidationException) {
      return {
        status: HttpStatus.BAD_REQUEST,
        message: this.validationMessages(exception).join(
          SOCKET_ERROR_SEPARATOR,
        ),
      };
    }

    if (
      exception instanceof HttpException &&
      exception.getStatus() < Number(HttpStatus.INTERNAL_SERVER_ERROR)
    ) {
      return { status: exception.getStatus(), message: exception.message };
    }

    this.logger.error(
      exception instanceof Error ? exception.message : String(exception),
      exception instanceof Error ? exception.stack : undefined,
    );

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: this.i18n.t('common.INTERNAL_ERROR'),
    };
  }

  private validationMessages(exception: I18nValidationException): string[] {
    return formatI18nErrors(exception.errors, this.i18n, {
      lang: I18nContext.current()?.lang,
    })
      .flatMap((error) => mapChildrenToValidationErrors(error))
      .flatMap(({ constraints }) => Object.values(constraints ?? {}));
  }
}
