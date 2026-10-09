import { toBoolean } from './boolean';

describe('toBoolean', () => {
  const transform = (raw: unknown) =>
    toBoolean({ obj: { flag: raw }, key: 'flag' });

  it.each([
    ['true', true],
    ['false', false],
    [true, true],
    [false, false],
  ])('reads %p as %p', (raw, expected) => {
    expect(transform(raw)).toBe(expected);
  });

  it.each(['yes', '1', '', 'constructor', '__proto__', 1])(
    'leaves %p for the validator to reject',
    (raw) => {
      expect(transform(raw)).toBe(raw);
    },
  );
});
