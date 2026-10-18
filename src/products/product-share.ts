import { truncateAtWord } from '../common/helpers/truncate-at-word';
import { Product } from './entities/product.entity';
import {
  ProductShare,
  ShareOrigins,
} from './interfaces/product-share.interface';
import {
  PRODUCT_WEB_PATH,
  SHARE_DESCRIPTION_MAX_LENGTH,
  SHARE_TARGETS,
} from './products.constants';

function withQuery(base: string, params: Record<string, string>): string {
  const url = new URL(base);

  for (const [name, value] of Object.entries(params)) {
    url.searchParams.set(name, value);
  }

  return url.toString();
}

export function shareOf(
  product: Pick<Product, 'name' | 'slug' | 'description'>,
  thumbnailUrl: string | null,
  { webUrl, apiUrl }: ShareOrigins,
): ProductShare {
  const url = new URL(
    `${PRODUCT_WEB_PATH}/${encodeURIComponent(product.slug)}`,
    `${webUrl}/`,
  ).toString();
  const { facebook, twitter } = SHARE_TARGETS;

  return {
    url,
    facebook: withQuery(facebook.url, { [facebook.link]: url }),
    twitter: withQuery(twitter.url, {
      [twitter.link]: url,
      [twitter.text]: product.name,
    }),
    title: product.name,
    description: product.description
      ? truncateAtWord(product.description, SHARE_DESCRIPTION_MAX_LENGTH)
      : null,
    image: thumbnailUrl ? new URL(thumbnailUrl, apiUrl).toString() : null,
  };
}
