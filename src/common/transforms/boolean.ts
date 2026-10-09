const BOOLEAN_STRINGS = new Map([
  ['true', true],
  ['false', false],
]);

export const toBoolean = ({
  obj,
  key,
}: {
  obj: Record<string, unknown>;
  key: string;
}): unknown => {
  const raw = obj[key];

  return typeof raw === 'string' ? (BOOLEAN_STRINGS.get(raw) ?? raw) : raw;
};
