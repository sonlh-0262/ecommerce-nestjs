import { definedFields } from './defined-fields';

describe('definedFields', () => {
  it('drops the fields that were not sent', () => {
    expect(definedFields({ a: 1, b: undefined })).toEqual({ a: 1 });
  });

  it('keeps null, which asks for the value to be cleared', () => {
    expect(definedFields({ a: null })).toEqual({ a: null });
  });

  it('keeps falsy values that were sent', () => {
    expect(definedFields({ a: '', b: 0, c: false })).toEqual({
      a: '',
      b: 0,
      c: false,
    });
  });
});
