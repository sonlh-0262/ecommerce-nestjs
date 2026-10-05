import request from 'supertest';
import { App } from 'supertest/types';

import { ErrorResponseDto } from '../../src/common/dto/error-response.dto';
import { AUTH_PATHS } from './test.constants';

export function errorMessages(body: unknown): string[] {
  return (body as ErrorResponseDto).errors.body;
}

export function bearer(token: string): [string, string] {
  return ['Authorization', `Bearer ${token}`];
}

export function loginRequest(
  server: App,
  email: string,
  password: string,
  query = '',
) {
  return request(server)
    .post(`${AUTH_PATHS.login}${query}`)
    .send({ user: { email, password } });
}
