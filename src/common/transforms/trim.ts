/** Normalises a value used for case-insensitive lookups (email, tag name). */
export const trimLower = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;
