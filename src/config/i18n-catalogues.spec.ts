import { readdirSync, readFileSync } from 'fs';
import * as path from 'path';

import { SUPPORTED_LANGUAGES } from '../common/constants/languages';

const I18N_ROOT = path.join(__dirname, '..', 'i18n');

describe('translation catalogues', () => {
  type Catalogue = { [key: string]: string | Catalogue };

  const keysOf = (catalogue: Catalogue, prefix = ''): string[] =>
    Object.entries(catalogue).flatMap(([key, value]) =>
      typeof value === 'string'
        ? [`${prefix}${key}`]
        : keysOf(value, `${prefix}${key}.`),
    );

  const load = (language: string, file: string): Catalogue =>
    JSON.parse(
      readFileSync(path.join(I18N_ROOT, language, file), 'utf8'),
    ) as Catalogue;

  const files = (language: string) =>
    readdirSync(path.join(I18N_ROOT, language)).sort();

  const [reference, ...others] = SUPPORTED_LANGUAGES;

  it.each(others)('%s ships the same files as the reference', (language) => {
    expect(files(language)).toEqual(files(reference));
  });

  describe.each(files(reference))('%s', (file) => {
    it.each(others)('defines the same keys in %s', (language) => {
      expect(keysOf(load(language, file)).sort()).toEqual(
        keysOf(load(reference, file)).sort(),
      );
    });

    it.each([...SUPPORTED_LANGUAGES])(
      'has no empty message in %s',
      (language) => {
        const catalogue = load(language, file);
        const empty = keysOf(catalogue).filter((key) => {
          const value = key
            .split('.')
            .reduce<string | Catalogue>(
              (node, part) => (node as Catalogue)[part],
              catalogue,
            );

          return typeof value !== 'string' || value.trim() === '';
        });

        expect(empty).toEqual([]);
      },
    );
  });
});
