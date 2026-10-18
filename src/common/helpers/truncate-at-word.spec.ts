import { truncateAtWord } from './truncate-at-word';

describe('truncateAtWord', () => {
  it('keeps a text that already fits', () => {
    expect(truncateAtWord('Áo thun cotton', 20)).toBe('Áo thun cotton');
  });

  it('cuts at the last word boundary and adds an ellipsis', () => {
    expect(truncateAtWord('Áo thun cotton basic form rộng', 20)).toBe(
      'Áo thun cotton…',
    );
  });

  it('never goes over the limit, ellipsis included', () => {
    const text = 'một hai ba bốn năm sáu bảy tám chín mười '.repeat(10);

    expect(truncateAtWord(text, 160).length).toBeLessThanOrEqual(160);
  });

  it('keeps a word that ends exactly at the limit', () => {
    expect(truncateAtWord('abcd efgh ijkl', 10)).toBe('abcd efgh…');
  });

  it('cuts inside a single word longer than the limit', () => {
    expect(truncateAtWord('a'.repeat(30), 10)).toBe(`${'a'.repeat(9)}…`);
  });

  it('flattens line breaks and repeated spaces', () => {
    expect(truncateAtWord('  Vải cotton\n\n100%   thoáng mát  ', 50)).toBe(
      'Vải cotton 100% thoáng mát',
    );
  });
});
