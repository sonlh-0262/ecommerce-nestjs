const CACHE_NAMESPACE = 'ecom';

const GENERATION_SUFFIX = 'generation';

export const CACHE_RESOURCES = {
  categories: 'categories',
  products: 'products',
} as const;

export type CacheResource =
  (typeof CACHE_RESOURCES)[keyof typeof CACHE_RESOURCES];

export type CacheVariant = (string | number | boolean)[];

export function generationKey(resource: CacheResource): string {
  return `${CACHE_NAMESPACE}:${resource}:${GENERATION_SUFFIX}`;
}

export function cacheKey(
  resource: CacheResource,
  generation: number,
  variant: CacheVariant,
): string {
  return [CACHE_NAMESPACE, resource, `v${generation}`, ...variant].join(':');
}
