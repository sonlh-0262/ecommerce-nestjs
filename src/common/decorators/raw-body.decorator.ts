import {
  createParamDecorator,
  ExecutionContext,
  RawBodyRequest,
} from '@nestjs/common';
import { Request } from 'express';

export const RawBody = createParamDecorator(
  (_data: unknown, context: ExecutionContext): Buffer | undefined =>
    context.switchToHttp().getRequest<RawBodyRequest<Request>>().rawBody,
);
