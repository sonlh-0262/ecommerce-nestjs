import { MailJobInput } from '../../src/mail/interfaces/mail-job.interface';
import { MailJobName } from '../../src/mail/mail.constants';

export interface RecordedMail {
  name: MailJobName;
  payload: MailJobInput<MailJobName>;
}

export class MailRecorder {
  readonly sent: RecordedMail[] = [];

  enqueue<T extends MailJobName>(
    name: T,
    payload: MailJobInput<T>,
  ): Promise<void> {
    this.sent.push({ name, payload });

    return Promise.resolve();
  }

  sentTo(email: string, name: MailJobName): RecordedMail[] {
    return this.sent.filter(
      (mail) => mail.name === name && mail.payload.to === email,
    );
  }

  tokenSentTo(email: string, name: MailJobName): string {
    const mail = this.sentTo(email, name).at(-1);
    const token = mail
      ? new URL(mail.payload.actionUrl).searchParams.get('token')
      : null;

    if (!token) {
      throw new Error(`No ${name} mail with a token was queued for ${email}`);
    }

    return token;
  }

  clear(): void {
    this.sent.length = 0;
  }
}
