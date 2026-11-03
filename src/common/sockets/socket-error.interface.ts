import { HttpStatus } from '@nestjs/common';

export interface SocketError {
  code: string;
  message: string;
}

export interface ResolvedSocketError {
  status: HttpStatus;
  error: SocketError;
}
