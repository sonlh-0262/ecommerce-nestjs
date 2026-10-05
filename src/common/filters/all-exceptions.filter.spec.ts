import {
  ArgumentsHost,
  BadRequestException,
  ForbiddenException,
  HttpStatus,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { QueryFailedError } from 'typeorm';

import {
  PG_CHECK_VIOLATION,
  PG_FOREIGN_KEY_VIOLATION,
  PG_UNIQUE_VIOLATION,
} from '../../database/database.constants';
import { ErrorResponseDto } from '../dto/error-response.dto';
import { AllExceptionsFilter } from './all-exceptions.filter';

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  let host: ArgumentsHost;
  let logError: jest.SpyInstance;

  const i18nMock = { t: jest.fn((key: string) => key) };
  const response = {
    headersSent: false,
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    end: jest.fn(),
  };

  const queryFailure = (code: string): QueryFailedError =>
    new QueryFailedError('INSERT ...', [], {
      code,
      constraint: 'UQ_users_username',
    } as unknown as Error);

  const rendered = (): { status: number; body: ErrorResponseDto } => {
    const [[status]] = response.status.mock.calls as [[number]];
    const [[body]] = response.json.mock.calls as [[ErrorResponseDto]];

    return { status, body };
  };

  beforeEach(() => {
    filter = new AllExceptionsFilter(i18nMock as unknown as I18nService);
    response.headersSent = false;
    host = {
      getType: () => 'http',
      switchToHttp: () => ({
        getResponse: () => response,
        getRequest: () => ({}),
      }),
    } as unknown as ArgumentsHost;

    logError = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  describe('HttpException', () => {
    it('keeps its status and message inside the envelope', () => {
      filter.catch(new ForbiddenException('auth.ACCOUNT_INACTIVE'), host);

      expect(rendered()).toEqual({
        status: HttpStatus.FORBIDDEN,
        body: { errors: { body: ['auth.ACCOUNT_INACTIVE'] } },
      });
    });

    it('keeps every message of a multi-message exception', () => {
      filter.catch(new BadRequestException(['first', 'second']), host);

      expect(rendered().body.errors.body).toEqual(['first', 'second']);
    });

    it('does not log a client error', () => {
      filter.catch(new ForbiddenException(), host);

      expect(logError).not.toHaveBeenCalled();
    });

    it('logs a server error and hides its message', () => {
      filter.catch(new InternalServerErrorException('pool exhausted'), host);

      expect(logError).toHaveBeenCalled();
      expect(rendered()).toEqual({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        body: { errors: { body: ['common.INTERNAL_ERROR'] } },
      });
    });
  });

  describe('QueryFailedError', () => {
    it.each([
      [PG_UNIQUE_VIOLATION, HttpStatus.CONFLICT, 'common.DUPLICATE_RESOURCE'],
      [
        PG_FOREIGN_KEY_VIOLATION,
        HttpStatus.UNPROCESSABLE_ENTITY,
        'common.RELATED_RESOURCE_MISSING',
      ],
      [
        PG_CHECK_VIOLATION,
        HttpStatus.UNPROCESSABLE_ENTITY,
        'common.CONSTRAINT_VIOLATED',
      ],
    ])('maps %s to %i', (code, status, messageKey) => {
      filter.catch(queryFailure(code), host);

      expect(rendered()).toEqual({
        status,
        body: { errors: { body: [messageKey] } },
      });
    });

    it('treats an unmapped database error as a 500', () => {
      filter.catch(queryFailure('42P01'), host);

      expect(rendered().status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(logError).toHaveBeenCalled();
    });

    it('never leaks the SQL to the client', () => {
      filter.catch(queryFailure(PG_UNIQUE_VIOLATION), host);

      expect(JSON.stringify(rendered().body)).not.toContain('INSERT');
    });
  });

  describe('anything else', () => {
    it('answers 500 with a generic message and logs the stack', () => {
      const error = new Error('password=secret at /srv/app/db.ts');

      filter.catch(error, host);

      expect(rendered()).toEqual({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        body: { errors: { body: ['common.INTERNAL_ERROR'] } },
      });
      expect(logError).toHaveBeenCalledWith(
        'Error: password=secret at /srv/app/db.ts',
        error.stack,
      );
    });

    it.each([
      [HttpStatus.BAD_REQUEST, 'common.MALFORMED_REQUEST'],
      [HttpStatus.PAYLOAD_TOO_LARGE, 'common.PAYLOAD_TOO_LARGE'],
      [HttpStatus.UNSUPPORTED_MEDIA_TYPE, 'common.INVALID_REQUEST'],
    ])(
      'keeps the status of an exposed %i raised outside Nest',
      (status, messageKey) => {
        const parserError = Object.assign(new SyntaxError('Unexpected end'), {
          status,
          expose: true,
        });

        filter.catch(parserError, host);

        expect(rendered()).toEqual({
          status,
          body: { errors: { body: [messageKey] } },
        });
      },
    );

    it('does not trust a status the error does not mark as exposable', () => {
      filter.catch(Object.assign(new Error('internal'), { status: 400 }), host);

      expect(rendered().status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    });

    it('handles a thrown value that is not an Error', () => {
      filter.catch('plain string', host);

      expect(rendered().status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  it('only closes the response once headers are already sent', () => {
    response.headersSent = true;

    filter.catch(new Error('late'), host);

    expect(response.status).not.toHaveBeenCalled();
    expect(response.end).toHaveBeenCalled();
  });
});
