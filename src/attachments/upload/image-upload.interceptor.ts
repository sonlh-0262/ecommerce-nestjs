import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  PayloadTooLargeException,
} from '@nestjs/common';
import { FileInterceptor, MulterModuleOptions } from '@nestjs/platform-express';
import { I18nService } from 'nestjs-i18n';
import { Observable } from 'rxjs';

import {
  IMAGE_UPLOAD_FIELD,
  MAX_FILE_SIZE,
  MAX_FILE_SIZE_MEGABYTES,
} from '../attachments.constants';

export const IMAGE_UPLOAD_OPTIONS: MulterModuleOptions = {
  limits: { fileSize: MAX_FILE_SIZE, files: 1, fields: 0, parts: 1 },
  defParamCharset: 'utf8',
};

const MulterInterceptor = FileInterceptor(
  IMAGE_UPLOAD_FIELD,
  IMAGE_UPLOAD_OPTIONS,
);

export function translateUploadError(
  error: unknown,
  i18n: I18nService,
): unknown {
  if (error instanceof PayloadTooLargeException) {
    return new PayloadTooLargeException(
      i18n.t('attachments.FILE_TOO_LARGE', {
        args: { limit: MAX_FILE_SIZE_MEGABYTES },
      }),
    );
  }

  if (error instanceof BadRequestException) {
    return new BadRequestException(i18n.t('attachments.INVALID_UPLOAD'));
  }

  return error;
}

@Injectable()
export class ImageUploadInterceptor implements NestInterceptor {
  private readonly multer: NestInterceptor = new MulterInterceptor();

  constructor(private readonly i18n: I18nService) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    try {
      return (await this.multer.intercept(
        context,
        next,
      )) as Observable<unknown>;
    } catch (error) {
      throw translateUploadError(error, this.i18n);
    }
  }
}
