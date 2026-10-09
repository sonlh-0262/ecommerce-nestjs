export function paginated<T, K extends string>(
  key: K,
  items: T[],
  total: number,
): Record<K, T[]> & Record<`${K}Count`, number> {
  return { [key]: items, [`${key}Count`]: total } as Record<K, T[]> &
    Record<`${K}Count`, number>;
}
