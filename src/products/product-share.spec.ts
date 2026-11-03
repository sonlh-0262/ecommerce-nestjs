import { shareOf } from './product-share';

describe('shareOf', () => {
  const ORIGINS = {
    webUrl: 'https://shop.example.com',
    apiUrl: 'https://api.example.com',
  };
  const PRODUCT = {
    name: 'Áo thun & quần short',
    slug: 'ao-thun-quan-short',
    description: 'Bộ đồ mặc nhà mùa hè.',
  };

  it('links the product page of the web front', () => {
    expect(shareOf(PRODUCT, null, ORIGINS).url).toBe(
      'https://shop.example.com/products/ao-thun-quan-short',
    );
  });

  it('keeps a path the web front is served under', () => {
    expect(
      shareOf(PRODUCT, null, { ...ORIGINS, webUrl: 'https://example.com/shop' })
        .url,
    ).toBe('https://example.com/shop/products/ao-thun-quan-short');
  });

  it('encodes the page URL into the Facebook sharer', () => {
    const facebook = new URL(shareOf(PRODUCT, null, ORIGINS).facebook);

    expect(facebook.origin + facebook.pathname).toBe(
      'https://www.facebook.com/sharer/sharer.php',
    );
    expect(facebook.search).toBe(
      '?u=https%3A%2F%2Fshop.example.com%2Fproducts%2Fao-thun-quan-short',
    );
  });

  it('encodes the page URL and the title into the tweet', () => {
    const twitter = new URL(shareOf(PRODUCT, null, ORIGINS).twitter);

    expect(twitter.searchParams.get('url')).toBe(
      'https://shop.example.com/products/ao-thun-quan-short',
    );
    expect(twitter.searchParams.get('text')).toBe('Áo thun & quần short');
    expect(twitter.search).not.toContain('&quần');
  });

  it('makes the thumbnail an absolute URL on the API origin', () => {
    expect(shareOf(PRODUCT, '/api/v1/attachments/9b1f', ORIGINS).image).toBe(
      'https://api.example.com/api/v1/attachments/9b1f',
    );
  });

  it('has no image without a thumbnail and no description without one', () => {
    expect(
      shareOf({ ...PRODUCT, description: null }, null, ORIGINS),
    ).toMatchObject({ image: null, description: null });
  });

  it('shortens a long description on a word boundary', () => {
    const description = 'Vải cotton thoáng mát '.repeat(20);
    const shared = shareOf({ ...PRODUCT, description }, null, ORIGINS);

    expect(shared.description?.length).toBeLessThanOrEqual(160);
    expect(shared.description).toMatch(/(cotton|thoáng|mát|Vải)…$/);
  });
});
