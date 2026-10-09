import {
  FALLBACK_FILE_NAME,
  FILE_NAME_MAX_LENGTH,
} from '../attachments.constants';

const FIRST_PRINTABLE = 0x20;
const DEL = 0x7f;
const ASCII_REPLACEMENT = '_';

const SEPARATORS = new Set([0x2f, 0x5c]);

const FORBIDDEN = new Set([0x22, 0x27, 0x60]);

function isSafe(character: string): boolean {
  const code = character.charCodeAt(0);

  return code >= FIRST_PRINTABLE && code !== DEL && !FORBIDDEN.has(code);
}

function leafOf(original: string): string[] {
  const characters = [...original];

  for (let index = characters.length - 1; index >= 0; index -= 1) {
    if (SEPARATORS.has(characters[index].charCodeAt(0))) {
      return characters.slice(index + 1);
    }
  }

  return characters;
}

function collapseWhitespace(value: string): string {
  return value
    .split(' ')
    .filter((part) => part !== '')
    .join(' ');
}

function stripLeadingDots(value: string): string {
  let result = value;

  while (result.startsWith('.')) {
    result = result.slice(1);
  }

  return result;
}

export function sanitiseFileName(original: string, extension: string): string {
  const cleaned = leafOf(original)
    .map((character) => (isSafe(character) ? character : ' '))
    .join('');

  const base = stripLeadingDots(collapseWhitespace(cleaned).trim());
  const named = base === '' ? FALLBACK_FILE_NAME : base;

  const withExtension = named.toLowerCase().endsWith(`.${extension}`)
    ? named
    : `${named}.${extension}`;

  const characters = [...withExtension];

  return characters.length > FILE_NAME_MAX_LENGTH
    ? `${characters.slice(0, FILE_NAME_MAX_LENGTH - extension.length - 1).join('')}.${extension}`
    : withExtension;
}

export function contentDisposition(fileName: string): string {
  return (
    `inline; filename="${asciiFallback(fileName)}"; ` +
    `filename*=UTF-8''${encodeURIComponent(fileName)}`
  );
}

function asciiFallback(fileName: string): string {
  return [...fileName]
    .map((character) => {
      const code = character.charCodeAt(0);

      return isSafe(character) && code < DEL && !SEPARATORS.has(code)
        ? character
        : ASCII_REPLACEMENT;
    })
    .join('');
}
