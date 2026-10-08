import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { I18nContext, I18nService } from 'nestjs-i18n';
import { QueryFailedError } from 'typeorm';

import {
  PG_CHECK_VIOLATION,
  PG_FOREIGN_KEY_VIOLATION,
  PG_UNIQUE_VIOLATION,
} from '../../database/database.constants';
import { toErrorResponse } from '../dto/error-response.dto';

const FIRST_CLIENT_ERROR: number = HttpStatus.BAD_REQUEST;
const FIRST_SERVER_ERROR: number = HttpStatus.INTERNAL_SERVER_ERROR;

interface ResolvedError {
  status: number;
  messages: string[];
}

interface QueryFailure {
  status: HttpStatus;
  messageKey: string;
}

const QUERY_FAILURES: Record<string, QueryFailure> = {
  [PG_UNIQUE_VIOLATION]: {
    status: HttpStatus.CONFLICT,
    messageKey: 'common.DUPLICATE_RESOURCE',
  },
  [PG_FOREIGN_KEY_VIOLATION]: {
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    messageKey: 'common.RELATED_RESOURCE_MISSING',
  },
  [PG_CHECK_VIOLATION]: {
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    messageKey: 'common.CONSTRAINT_VIOLATED',
  },
};

const CLIENT_ERROR_KEYS: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'common.MALFORMED_REQUEST',
  [HttpStatus.PAYLOAD_TOO_LARGE]: 'common.PAYLOAD_TOO_LARGE',
};

const DEFAULT_CLIENT_ERROR_KEY = 'common.INVALID_REQUEST';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly i18n: I18nService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const { status, messages } = this.resolve(exception, host);

    if (response.headersSent) {
      this.logger.error(
        `Error after the response started: ${describe(exception)}`,
      );
      response.end();

      return;
    }

    response.status(status).json(toErrorResponse(messages));
  }

  private resolve(exception: unknown, host: ArgumentsHost): ResolvedError {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();

      if (status >= FIRST_SERVER_ERROR) {
        this.logger.error(describe(exception), stackOf(exception));

        return {
          status,
          messages: [this.translate('common.INTERNAL_ERROR', host)],
        };
      }

      return { status, messages: messagesOf(exception) };
    }

    if (exception instanceof QueryFailedError) {
      return this.resolveQueryFailure(exception as QueryFailedError, host);
    }

    const clientStatus = exposedClientStatus(exception);

    if (clientStatus) {
      return {
        status: clientStatus,
        messages: [
          this.translate(
            CLIENT_ERROR_KEYS[clientStatus] ?? DEFAULT_CLIENT_ERROR_KEY,
            host,
          ),
        ],
      };
    }

    this.logger.error(describe(exception), stackOf(exception));

    return this.internalError(host);
  }

  private resolveQueryFailure(
    exception: QueryFailedError,
    host: ArgumentsHost,
  ): ResolvedError {
    const { code, constraint } = exception.driverError as {
      code?: string;
      constraint?: string;
    };
    const failure = code ? QUERY_FAILURES[code] : undefined;

    if (!failure) {
      this.logger.error(describe(exception), stackOf(exception));

      return this.internalError(host);
    }

    this.logger.warn(`${code} on ${constraint ?? 'unknown constraint'}`);

    return {
      status: failure.status,
      messages: [this.translate(failure.messageKey, host)],
    };
  }

  private internalError(host: ArgumentsHost): ResolvedError {
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      messages: [this.translate('common.INTERNAL_ERROR', host)],
    };
  }

  private translate(key: string, host: ArgumentsHost): string {
    return I18nContext.current(host)?.t(key) ?? this.i18n.t(key);
  }
}

function messagesOf(exception: HttpException): string[] {
  const response = exception.getResponse();

  if (typeof response === 'string') {
    return [response];
  }

  const { message } = response as { message?: unknown };

  if (Array.isArray(message)) {
    return message.map(String);
  }

  return [typeof message === 'string' ? message : exception.message];
}

function exposedClientStatus(exception: unknown): number | null {
  if (typeof exception !== 'object' || exception === null) {
    return null;
  }

  const { status, expose } = exception as {
    status?: unknown;
    expose?: unknown;
  };

  const isClientStatus =
    typeof status === 'number' &&
    status >= FIRST_CLIENT_ERROR &&
    status < FIRST_SERVER_ERROR;

  return isClientStatus && expose === true ? status : null;
}

function describe(exception: unknown): string {
  return exception instanceof Error
    ? `${exception.name}: ${exception.message}`
    : String(exception);
}

function stackOf(exception: unknown): string | undefined {
  return exception instanceof Error ? exception.stack : undefined;
}
