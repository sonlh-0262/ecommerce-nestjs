export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message = `timeout of ${timeoutMs}ms exceeded`,
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;

  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
