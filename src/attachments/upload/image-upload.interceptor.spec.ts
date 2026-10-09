import {
  BadRequestException,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';

import { MAX_FILE_SIZE_MEGABYTES } from '../attachments.constants';
import { translateUploadError } from './image-upload.interceptor';

describe('translateUploadError', () => {
  const i18nMock = { t: jest.fn((key: string) => key) };
  const i18n = i18nMock as unknown as I18nService;

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('translates the 413 Multer raises for a file that is too large', () => {
    const translated = translateUploadError(
      new PayloadTooLargeException('File too large'),
      i18n,
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
    );

    expect(translated).toBeInstanceOf(BadRequestException);
    expect((translated as Error).message).toBe('attachments.INVALID_UPLOAD');
  });

  it('passes any other error through untouched', () => {
    const notFound = new NotFoundException('missing');

    expect(translateUploadError(notFound, i18n)).toBe(notFound);
  });
});
