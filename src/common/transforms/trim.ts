/** Normalises a value used for case-insensitive lookups (email, tag name). */
export const trimLower = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export const trimToNull = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() || null : value;
