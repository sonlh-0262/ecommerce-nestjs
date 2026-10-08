import {
  BadRequestException,
  Injectable,
  PayloadTooLargeException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';

import {
  MAX_FILE_SIZE,
  MAX_FILE_SIZE_MEGABYTES,
} from '../attachments.constants';
import {
  UploadedImage,
  ValidatedImage,
} from '../interfaces/uploaded-image.interface';
import { detectImageType } from './image-signature';

@Injectable()
export class ImageFileValidator {
  constructor(private readonly i18n: I18nService) {}

  validate(file: UploadedImage | undefined): ValidatedImage {
    if (!file?.buffer) {
      throw new BadRequestException(this.i18n.t('attachments.FILE_REQUIRED'));
    }

    if (file.buffer.length > MAX_FILE_SIZE) {
      throw new PayloadTooLargeException(
        this.i18n.t('attachments.FILE_TOO_LARGE', {
          args: { limit: MAX_FILE_SIZE_MEGABYTES },
        }),
      );
    }

    const imageType = detectImageType(file.buffer);

    if (!imageType) {
      throw new UnprocessableEntityException(
        this.i18n.t('attachments.INVALID_FILE_TYPE'),
      );
    }

    return {
      originalname: file.originalname,
      buffer: file.buffer,
      type: imageType,
    };
  }
}
