import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  Injectable,
  mixin,
  NestInterceptor,
  PayloadTooLargeException,
  Type,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  FileInterceptor,
  FilesInterceptor,
  MulterModuleOptions,
} from '@nestjs/platform-express';
import { multerExceptions } from '@nestjs/platform-express/multer/multer/multer.constants';
import { I18nService } from 'nestjs-i18n';
import { Observable } from 'rxjs';

import {
  MAX_FILE_SIZE,
  MAX_FILE_SIZE_MEGABYTES,
} from '../attachments.constants';
import { ImageUploadSpec } from '../interfaces/image-upload-spec.interface';

export function imageUploadOptions({
  maxFiles,
  textFields,
}: ImageUploadSpec): MulterModuleOptions {
  return {
    limits: {
      fileSize: MAX_FILE_SIZE,
      files: maxFiles,
      fields: textFields,
      parts: maxFiles + textFields,
    },
    defParamCharset: 'utf8',
  };
}

export function translateUploadError(
  error: unknown,
  i18n: I18nService,
  spec: ImageUploadSpec,
): unknown {
  if (error instanceof PayloadTooLargeException) {
    return new PayloadTooLargeException(
      i18n.t('attachments.FILE_TOO_LARGE', {
        args: { limit: MAX_FILE_SIZE_MEGABYTES },
      }),
    );
  }

  if (!(error instanceof BadRequestException)) {
    return error;
  }

  if (spec.maxFiles === 1) {
    return new BadRequestException(i18n.t('attachments.INVALID_UPLOAD'));
  }

  const args = { field: spec.field, limit: spec.maxFiles };

  return error.message === multerExceptions.LIMIT_FILE_COUNT
    ? new UnprocessableEntityException(
        i18n.t('attachments.TOO_MANY_FILES', { args }),
      )
    : new BadRequestException(i18n.t('attachments.INVALID_UPLOADS', { args }));
}

export function ImageUploadInterceptor(
  spec: ImageUploadSpec,
): Type<NestInterceptor> {
  const options = imageUploadOptions(spec);
  const MulterInterceptor =
    spec.maxFiles === 1
      ? FileInterceptor(spec.field, options)
      : FilesInterceptor(spec.field, spec.maxFiles, options);

  @Injectable()
  class TranslatedImageUploadInterceptor implements NestInterceptor {
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
        throw translateUploadError(error, this.i18n, spec);
      }
    }
  }

  return mixin(TranslatedImageUploadInterceptor);
}
