export class InvalidWebhookError extends Error {
  constructor(reason: string) {
    super(`Invalid payment webhook: ${reason}`);
    this.name = InvalidWebhookError.name;
  }
}
