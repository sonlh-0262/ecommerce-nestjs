import { validateSync } from 'class-validator';

import {
  AT_LEAST_ONE_FIELD,
  AtLeastOneField,
  hasDefinedField,
} from './at-least-one-field.validator';

describe('hasDefinedField', () => {
  it('accepts an object with one field set', () => {
    expect(hasDefinedField({ a: undefined, b: 'x' })).toBe(true);
  });

  it('accepts a field explicitly set to null', () => {
    expect(hasDefinedField({ a: null })).toBe(true);
  });

  it('rejects an object whose fields were all left out', () => {
    expect(hasDefinedField({ a: undefined })).toBe(false);
  });

  it('rejects an empty object', () => {
    expect(hasDefinedField({})).toBe(false);
  });
});

describe('@AtLeastOneField()', () => {
  class Envelope {
    @AtLeastOneField()
    body: unknown;

    constructor(body: unknown) {
      this.body = body;
    }
  }

  const failures = (body: unknown) =>
    validateSync(new Envelope(body)).flatMap((error) =>
      Object.keys(error.constraints ?? {}),
    );

  it('fails an object with nothing in it', () => {
    expect(failures({})).toEqual([AT_LEAST_ONE_FIELD]);
  });

  it('passes an object with a field', () => {
    expect(failures({ name: 'x' })).toEqual([]);
  });

  it('leaves a value that is not an object to the type check', () => {
    expect(failures('x')).toEqual([]);
  });
});
