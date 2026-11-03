import { MESSAGE_CLOCK_STEP_MS } from './chat.constants';

export function nextMessageTime(
  lastMessageAt: Date | null,
  now: Date = new Date(),
): Date {
  if (lastMessageAt && lastMessageAt.getTime() >= now.getTime()) {
    return new Date(lastMessageAt.getTime() + MESSAGE_CLOCK_STEP_MS);
  }

  return now;
}
