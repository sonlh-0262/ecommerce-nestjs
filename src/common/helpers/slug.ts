import slugify from 'slugify';

import { uniqueViolationConstraint } from '../../database/unique-violation';
import {
  FIRST_SLUG_SUFFIX,
  SLUG_FALLBACK,
  SLUG_LOCALE,
  SLUG_SAVE_ATTEMPTS,
  SLUG_SEPARATOR,
} from '../constants/slug';

const TRAILING_SEPARATORS = new RegExp(`${SLUG_SEPARATOR}+$`);

export interface SlugOptions {
  maxLength: number;
  reserved?: readonly string[];
  exists: (slug: string) => Promise<boolean>;
}

export interface UniqueSlugOptions extends SlugOptions {
  constraint: string;
}

function fit(slug: string, maxLength: number): string {
  return slug.slice(0, maxLength).replace(TRAILING_SEPARATORS, '');
}

export function generateSlug(name: string, maxLength: number): string {
  const slug = fit(
    slugify(name, {
      lower: true,
      strict: true,
      locale: SLUG_LOCALE,
      trim: true,
      replacement: SLUG_SEPARATOR,
    }),
    maxLength,
  );

  return slug || SLUG_FALLBACK;
}

export async function ensureUniqueSlug(
  base: string,
  { maxLength, reserved = [], exists }: SlugOptions,
): Promise<string> {
  const taken = async (slug: string) =>
    reserved.includes(slug) || (await exists(slug));
  let candidate = fit(base, maxLength);

  for (let suffix = FIRST_SLUG_SUFFIX; await taken(candidate); suffix += 1) {
    const ending = `${SLUG_SEPARATOR}${suffix}`;

    candidate = `${fit(base, maxLength - ending.length)}${ending}`;
  }

  return candidate;
}

export async function saveWithUniqueSlug<T>(
  name: string,
  options: UniqueSlugOptions,
  save: (slug: string) => Promise<T>,
): Promise<T> {
  const base = generateSlug(name, options.maxLength);

  for (let attempt = 1; ; attempt += 1) {
    const slug = await ensureUniqueSlug(base, options);

    try {
      return await save(slug);
    } catch (error) {
      const lostRace =
        uniqueViolationConstraint(error) === options.constraint &&
        attempt < SLUG_SAVE_ATTEMPTS;

      if (!lostRace) {
        throw error;
      }
    }
  }
}
