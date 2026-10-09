import {
  BadRequestException,
  NotFoundException,
  PayloadTooLargeException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { multerExceptions } from '@nestjs/platform-express/multer/multer/multer.constants';
import { I18nService } from 'nestjs-i18n';

import {
  MAX_FILE_SIZE,
  MAX_FILE_SIZE_MEGABYTES,
  SINGLE_IMAGE_UPLOAD,
} from '../attachments.constants';
import {
  imageUploadOptions,
  translateUploadError,
} from './image-upload.interceptor';

describe('translateUploadError', () => {
  const GALLERY = { field: 'files', maxFiles: 5, textFields: 1 };

  const i18nMock = { t: jest.fn((key: string) => key) };
  const i18n = i18nMock as unknown as I18nService;

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('translates the 413 Multer raises for a file that is too large', () => {
    const translated = translateUploadError(
      new PayloadTooLargeException('File too large'),
      i18n,
      SINGLE_IMAGE_UPLOAD,
    );

    expect(translated).toBeInstanceOf(PayloadTooLargeException);
    expect((translated as Error).message).toBe('attachments.FILE_TOO_LARGE');
    expect(i18nMock.t).toHaveBeenCalledWith('attachments.FILE_TOO_LARGE', {
      args: { limit: MAX_FILE_SIZE_MEGABYTES },
    });
  });

  it('replaces the English text of any other Multer rejection', () => {
    const translated = translateUploadError(
      new BadRequestException('Unexpected field - avatar'),
      i18n,
      SINGLE_IMAGE_UPLOAD,
    );

    expect(translated).toBeInstanceOf(BadRequestException);
    expect((translated as Error).message).toBe('attachments.INVALID_UPLOAD');
  });

  it('keeps a second file on a single upload a 400', () => {
    const translated = translateUploadError(
      new BadRequestException(multerExceptions.LIMIT_FILE_COUNT),
      i18n,
      SINGLE_IMAGE_UPLOAD,
    );

    expect(translated).toBeInstanceOf(BadRequestException);
  });

  it('turns too many files on a multi-file upload into 422', () => {
    const translated = translateUploadError(
      new BadRequestException(multerExceptions.LIMIT_FILE_COUNT),
      i18n,
      GALLERY,
    );

    expect(translated).toBeInstanceOf(UnprocessableEntityException);
    expect(i18nMock.t).toHaveBeenCalledWith('attachments.TOO_MANY_FILES', {
      args: { field: 'files', limit: 5 },
    });
  });

  it('names the field and the limit for a malformed multi-file upload', () => {
    const translated = translateUploadError(
      new BadRequestException(multerExceptions.LIMIT_UNEXPECTED_FILE),
      i18n,
      GALLERY,
    );

    expect(translated).toBeInstanceOf(BadRequestException);
    expect((translated as Error).message).toBe('attachments.INVALID_UPLOADS');
  });

  it('passes any other error through untouched', () => {
    const notFound = new NotFoundException('missing');

    expect(translateUploadError(notFound, i18n, GALLERY)).toBe(notFound);
  });
});

describe('imageUploadOptions', () => {
  it('bounds every part of the multipart body', () => {
    expect(
      imageUploadOptions({ field: 'files', maxFiles: 5, textFields: 1 }),
    ).toEqual({
      limits: { fileSize: MAX_FILE_SIZE, files: 5, fields: 1, parts: 6 },
      defParamCharset: 'utf8',
    });
  });
});
