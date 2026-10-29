import { HttpStatus } from '@nestjs/common';

export const SOCKET_ERROR_EVENT = 'error';

export const SOCKET_CLOSING_STATUSES: ReadonlySet<number> = new Set([
  HttpStatus.UNAUTHORIZED,
  HttpStatus.FORBIDDEN,
]);

export const SOCKET_ERROR_SEPARATOR = '; ';
