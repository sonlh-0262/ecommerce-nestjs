import { applyDecorators, HttpStatus, UseInterceptors } from '@nestjs/common';
import { ApiBody, ApiConsumes, SchemaObject } from '@nestjs/swagger';

import { ApiErrorResponse } from '../../common/decorators/api-error-response.decorator';
import {
  ALLOWED_IMAGE_TYPES,
  MAX_FILE_SIZE_MEGABYTES,
  SINGLE_IMAGE_UPLOAD,
} from '../attachments.constants';
import { ImageUploadSpec } from '../interfaces/image-upload-spec.interface';
import { ImageUploadInterceptor } from './image-upload.interceptor';

const IMAGE_FILE: SchemaObject = {
  type: 'string',
  format: 'binary',
  description: `${ALLOWED_IMAGE_TYPES.join(', ')}, at most ${MAX_FILE_SIZE_MEGABYTES} MB.`,
};

export function UploadImages(
  spec: ImageUploadSpec,
  textFields: Record<string, SchemaObject> = {},
) {
  const multiple = spec.maxFiles > 1;

  return applyDecorators(
    UseInterceptors(ImageUploadInterceptor(spec)),
    ApiConsumes('multipart/form-data'),
    ApiBody({
      schema: {
        type: 'object',
        required: [spec.field],
        properties: {
          [spec.field]: multiple
            ? {
                type: 'array',
                items: IMAGE_FILE,
                minItems: 1,
                maxItems: spec.maxFiles,
              }
            : IMAGE_FILE,
          ...textFields,
        },
      },
    }),
    ApiErrorResponse(
      HttpStatus.BAD_REQUEST,
      'No file was sent, or the multipart body is malformed or has other parts.',
    ),
    ApiErrorResponse(
      HttpStatus.PAYLOAD_TOO_LARGE,
      `A file is larger than ${MAX_FILE_SIZE_MEGABYTES} MB.`,
    ),
    ApiErrorResponse(
      HttpStatus.UNPROCESSABLE_ENTITY,
      multiple
        ? `A file is not a JPEG, PNG or WebP image, or more than ${spec.maxFiles} were sent.`
        : 'The content is not a JPEG, PNG or WebP image.',
    ),
  );
}

export const UploadImage = () => UploadImages(SINGLE_IMAGE_UPLOAD);
