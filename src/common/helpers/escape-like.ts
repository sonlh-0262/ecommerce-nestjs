const LIKE_SPECIAL_CHARACTERS = /[\\%_]/g;

export function escapeLike(value: string): string {
  return value.replace(
    LIKE_SPECIAL_CHARACTERS,
    (character) => `\\${character}`,
  );
}

export function containsPattern(value: string): string {
  return `%${escapeLike(value)}%`;
}
