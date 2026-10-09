import { applyDecorators, HttpStatus, UseInterceptors } from '@nestjs/common';
import { ApiBody, ApiConsumes } from '@nestjs/swagger';

import { ApiErrorResponse } from '../../common/decorators/api-error-response.decorator';
import {
  ALLOWED_IMAGE_TYPES,
  IMAGE_UPLOAD_FIELD,
  MAX_FILE_SIZE_MEGABYTES,
} from '../attachments.constants';
import { ImageUploadInterceptor } from './image-upload.interceptor';

export function UploadImage() {
  return applyDecorators(
    UseInterceptors(ImageUploadInterceptor),
    ApiConsumes('multipart/form-data'),
    ApiBody({
      schema: {
        type: 'object',
        required: [IMAGE_UPLOAD_FIELD],
        properties: {
          [IMAGE_UPLOAD_FIELD]: {
            type: 'string',
            format: 'binary',
            description: `${ALLOWED_IMAGE_TYPES.join(', ')}, at most ${MAX_FILE_SIZE_MEGABYTES} MB.`,
          },
        },
      },
    }),
    ApiErrorResponse(
      HttpStatus.BAD_REQUEST,
      'No file was sent, or the multipart body is malformed or has other parts.',
    ),
    ApiErrorResponse(
      HttpStatus.PAYLOAD_TOO_LARGE,
      `The file is larger than ${MAX_FILE_SIZE_MEGABYTES} MB.`,
    ),
    ApiErrorResponse(
      HttpStatus.UNPROCESSABLE_ENTITY,
      'The content is not a JPEG, PNG or WebP image.',
    ),
  );
}
