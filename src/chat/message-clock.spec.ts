import { MESSAGE_CLOCK_STEP_MS } from './chat.constants';
import { nextMessageTime } from './message-clock';

describe('nextMessageTime', () => {
  const NOW = new Date('2026-10-29T08:30:00.000Z');

  it('stamps the first message of a conversation with the current time', () => {
    expect(nextMessageTime(null, NOW)).toEqual(NOW);
  });

  it('keeps the current time when the previous message is older', () => {
    expect(nextMessageTime(new Date(NOW.getTime() - 5), NOW)).toEqual(NOW);
  });

  it.each([0, 3])(
    'moves past a previous message %d ms ahead, so two never share an instant',
    (ahead) => {
      const previous = new Date(NOW.getTime() + ahead);

      expect(nextMessageTime(previous, NOW)).toEqual(
        new Date(previous.getTime() + MESSAGE_CLOCK_STEP_MS),
      );
    },
  );

  it('defaults to the wall clock', () => {
    const before = Date.now();

    expect(nextMessageTime(null).getTime()).toBeGreaterThanOrEqual(before);
  });
});
