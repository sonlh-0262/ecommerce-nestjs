const ELLIPSIS = '…';

export function truncateAtWord(text: string, maxLength: number): string {
  const flat = text.replace(/\s+/g, ' ').trim();

  if (flat.length <= maxLength) {
    return flat;
  }

  const room = maxLength - ELLIPSIS.length;
  const head = flat.slice(0, room + 1);
  const lastSpace = head.lastIndexOf(' ');
  const kept = lastSpace > 0 ? head.slice(0, lastSpace) : head.slice(0, room);

  return `${kept.trimEnd()}${ELLIPSIS}`;
}
