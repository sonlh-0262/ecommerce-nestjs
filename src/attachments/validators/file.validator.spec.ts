import {
  BadRequestException,
  PayloadTooLargeException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';

import { MAX_FILE_SIZE } from '../attachments.constants';
import { ImageFileValidator } from './file.validator';

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(16, 0x00),
]);

const PDF = Buffer.concat([
  Buffer.from('%PDF-1.7', 'latin1'),
  Buffer.alloc(16, 0x00),
]);

describe('ImageFileValidator', () => {
  const i18nMock = { t: jest.fn((key: string) => key) };
  const validator = new ImageFileValidator(i18nMock as unknown as I18nService);

  it('accepts a PNG and reports what it is', () => {
    expect(validator.validate({ originalname: 'a.png', buffer: PNG })).toEqual({
      originalname: 'a.png',
      buffer: PNG,
      type: { mime: 'image/png', extension: 'png' },
    });
  });

  it('rejects a PDF renamed to .png with 422', () => {
    expect(() =>
      validator.validate({ originalname: 'avatar.png', buffer: PDF }),
    ).toThrow(UnprocessableEntityException);
  });

  it('explains the rejection with a translated message', () => {
    expect(() =>
      validator.validate({ originalname: 'avatar.png', buffer: PDF }),
    ).toThrow('attachments.INVALID_FILE_TYPE');
  });

  it('rejects a file over 2 MB with 413', () => {
    const tooLarge = Buffer.concat([PNG, Buffer.alloc(MAX_FILE_SIZE)]);

    expect(() =>
      validator.validate({ originalname: 'big.png', buffer: tooLarge }),
    ).toThrow(PayloadTooLargeException);
  });

  it('accepts a file of exactly the limit', () => {
    const atLimit = Buffer.concat([
      PNG,
      Buffer.alloc(MAX_FILE_SIZE - PNG.length),
    ]);

    expect(() =>
      validator.validate({ originalname: 'edge.png', buffer: atLimit }),
    ).not.toThrow();
  });

  it('rejects a request that carried no file with 400', () => {
    expect(() => validator.validate(undefined)).toThrow(BadRequestException);
    expect(() => validator.validate(undefined)).toThrow(
      'attachments.FILE_REQUIRED',
    );
  });

  it('checks the size before reading the content', () => {
    const largePdf = Buffer.concat([PDF, Buffer.alloc(MAX_FILE_SIZE)]);

    expect(() =>
      validator.validate({ originalname: 'big.pdf', buffer: largePdf }),
    ).toThrow(PayloadTooLargeException);
  });
});
