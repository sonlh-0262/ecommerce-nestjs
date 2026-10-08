import { containsPattern, escapeLike } from './escape-like';

describe('escapeLike', () => {
  it('leaves ordinary text alone', () => {
    expect(escapeLike('son@example.com')).toBe('son@example.com');
  });

  it('escapes the LIKE wildcards so they match literally', () => {
    expect(escapeLike('50%_off')).toBe('50\\%\\_off');
  });

  it('escapes the escape character itself', () => {
    expect(escapeLike('a\\b')).toBe('a\\\\b');
  });
});

describe('containsPattern', () => {
  it('matches the escaped text anywhere in the column', () => {
    expect(containsPattern('a_b')).toBe('%a\\_b%');
  });
});
