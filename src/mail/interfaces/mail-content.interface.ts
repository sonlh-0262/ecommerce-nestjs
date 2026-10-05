export type MailTranslator = (
  key: string,
  args?: Record<string, string | number>,
) => string;

export interface MailContent {
  subject: string;
  template: string;
  context: Record<string, unknown>;
}
