import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Response } from 'express';
import { map, Observable } from 'rxjs';

import { AttachmentStreamableFile } from './attachment-streamable-file';

@Injectable()
export class CacheControlInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const response = context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      map((body: unknown) => {
        if (body instanceof AttachmentStreamableFile) {
          response.setHeader('Cache-Control', body.cacheControl);
        }

        return body;
      }),
    );
  }
}
