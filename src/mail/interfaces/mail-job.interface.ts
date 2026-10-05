import { SupportedLanguage } from '../../common/constants/languages';
import { MAIL_JOB, MailJobName } from '../mail.constants';

export interface BaseMailJob {
  to: string;
  lang: SupportedLanguage;
}

export interface ActionMailJob extends BaseMailJob {
  fullName: string | null;
  actionUrl: string;
  expiresInMinutes: number;
}

export interface MailJobPayloadMap {
  [MAIL_JOB.VerifyEmail]: ActionMailJob;
  [MAIL_JOB.ResetPassword]: ActionMailJob;
}

export type MailJobPayload<T extends MailJobName> = MailJobPayloadMap[T];

export type MailJobInput<T extends MailJobName> = Omit<
  MailJobPayload<T>,
  'lang'
>;
