import { ArgumentMetadata, BadRequestException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';

import { ParseUuidPipe } from './parse-uuid.pipe';

describe('ParseUuidPipe', () => {
  const i18nMock = {
    t: jest.fn(
      (key: string, options: { args: { property: string } }) =>
        `${key}:${options.args.property}`,
    ),
  };
  const pipe = new ParseUuidPipe(i18nMock as unknown as I18nService);
  const metadata: ArgumentMetadata = { type: 'param', data: 'id' };

  it('passes a uuid through unchanged', () => {
    const id = '2f1c7a0e-5b7d-4b8e-9a4f-0c7f6f0d9a11';

    expect(pipe.transform(id, metadata)).toBe(id);
  });

  it('rejects anything else with a translated 400 naming the parameter', () => {
    expect(() => pipe.transform('not-a-uuid', metadata)).toThrow(
      new BadRequestException('validation.IS_UUID:id'),
    );
  });

  it('rejects SQL smuggled into the id', () => {
    expect(() => pipe.transform("1' OR '1'='1", metadata)).toThrow(
      BadRequestException,
    );
  });
});
