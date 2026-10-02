let counter = 0;

/**
 * Keeps the unique-indexed columns (`users.email`, `users.username`) distinct
 * between fixtures.
 *
 * A counter rather than a uuid because it reaches failure messages: `user-7`
 * and `user-8` say which rows a case created, and in what order.
 */
export function nextSequence(): number {
  counter += 1;

  return counter;
}
