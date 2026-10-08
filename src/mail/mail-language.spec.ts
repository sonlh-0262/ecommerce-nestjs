import { resolveMailLanguage } from './mail-language';

describe('resolveMailLanguage', () => {
  it.each([
    ['vi', 'vi'],
    ['en', 'en'],
    ['EN', 'en'],
    ['vi-VN', 'vi'],
    [' en-GB ', 'en'],
  ])('maps %s onto the %s catalogue', (lang, expected) => {
    expect(resolveMailLanguage(lang)).toBe(expected);
  });

  it.each([undefined, null, '', 'fr'])(
    'falls back to Vietnamese for %p',
    (lang) => {
      expect(resolveMailLanguage(lang)).toBe('vi');
    },
  );
});
