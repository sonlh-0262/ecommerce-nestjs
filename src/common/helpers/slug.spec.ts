import { QueryFailedError } from 'typeorm';

import { PG_UNIQUE_VIOLATION } from '../../database/database.constants';
import { SLUG_FALLBACK, SLUG_SAVE_ATTEMPTS } from '../constants/slug';
import { ensureUniqueSlug, generateSlug, saveWithUniqueSlug } from './slug';

const MAX_LENGTH = 20;
const CONSTRAINT = 'UQ_things_slug';

const takenAmong =
  (...taken: string[]) =>
  (slug: string) =>
    Promise.resolve(taken.includes(slug));

const uniqueViolation = (constraint: string) =>
  new QueryFailedError('INSERT', [], {
    code: PG_UNIQUE_VIOLATION,
    constraint,
  } as unknown as Error);

describe('generateSlug', () => {
  it.each([
    ['Áo Thun Nam', 'ao-thun-nam'],
    ['Đồng hồ thông minh', 'dong-ho-thong-minh'],
    ['  Quạt   điều hoà!  ', 'quat-dieu-hoa'],
    ['Sữa rửa mặt 100ml', 'sua-rua-mat-100ml'],
  ])('turns %p into %p', (name, slug) => {
    expect(generateSlug(name, MAX_LENGTH)).toBe(slug);
  });

  it('cuts a long name to the limit without a trailing separator', () => {
    const slug = generateSlug('Bàn phím cơ ngắn ab dây', MAX_LENGTH);

    expect(slug).toBe('ban-phim-co-ngan-ab');
    expect(slug.length).toBeLessThanOrEqual(MAX_LENGTH);
  });

  it('falls back to a valid slug when nothing is left', () => {
    expect(generateSlug('!!! ???', MAX_LENGTH)).toBe(SLUG_FALLBACK);
  });
});

describe('ensureUniqueSlug', () => {
  const options = (...taken: string[]) => ({
    maxLength: MAX_LENGTH,
    exists: takenAmong(...taken),
  });

  it('keeps a free slug as it is', async () => {
    await expect(ensureUniqueSlug('ao-thun', options())).resolves.toBe(
      'ao-thun',
    );
  });

  it('treats a reserved slug as taken', async () => {
    await expect(
      ensureUniqueSlug('featured', { ...options(), reserved: ['featured'] }),
    ).resolves.toBe('featured-2');
  });

  it('appends -2, then -3, until the slug is free', async () => {
    await expect(
      ensureUniqueSlug('ao-thun', options('ao-thun', 'ao-thun-2')),
    ).resolves.toBe('ao-thun-3');
  });

  it('cuts the base before the suffix so the slug still fits', async () => {
    const base = 'a'.repeat(MAX_LENGTH);

    const slug = await ensureUniqueSlug(base, options(base));

    expect(slug).toBe(`${'a'.repeat(MAX_LENGTH - 2)}-2`);
    expect(slug).toHaveLength(MAX_LENGTH);
  });
});

describe('saveWithUniqueSlug', () => {
  const options = { maxLength: MAX_LENGTH, constraint: CONSTRAINT };

  it('saves under the slug of the name', async () => {
    const save = jest.fn((slug: string) => Promise.resolve(slug));

    await expect(
      saveWithUniqueSlug('Áo Thun', { ...options, exists: takenAmong() }, save),
    ).resolves.toBe('ao-thun');
  });

  it('tries again when another writer took the slug first', async () => {
    const taken: string[] = [];
    const save = jest
      .fn()
      .mockImplementationOnce((slug: string) => {
        taken.push(slug);

        return Promise.reject(uniqueViolation(CONSTRAINT));
      })
      .mockImplementation((slug: string) => Promise.resolve(slug));

    await expect(
      saveWithUniqueSlug(
        'Áo Thun',
        { ...options, exists: (slug) => Promise.resolve(taken.includes(slug)) },
        save,
      ),
    ).resolves.toBe('ao-thun-2');
  });

  it(`gives up after ${SLUG_SAVE_ATTEMPTS} lost races`, async () => {
    const save = jest.fn(() => Promise.reject(uniqueViolation(CONSTRAINT)));

    await expect(
      saveWithUniqueSlug('Áo Thun', { ...options, exists: takenAmong() }, save),
    ).rejects.toBeInstanceOf(QueryFailedError);

    expect(save).toHaveBeenCalledTimes(SLUG_SAVE_ATTEMPTS);
  });

  it('does not retry another failure', async () => {
    const save = jest.fn(() =>
      Promise.reject(uniqueViolation('UQ_something_else')),
    );

    await expect(
      saveWithUniqueSlug('Áo Thun', { ...options, exists: takenAmong() }, save),
    ).rejects.toBeInstanceOf(QueryFailedError);

    expect(save).toHaveBeenCalledTimes(1);
  });
});
