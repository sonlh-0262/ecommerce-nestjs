import { JobsOptions } from 'bullmq';

import { SupportedLanguage } from '../common/constants/languages';

export const MAIL_QUEUE = 'mail';

export const MAIL_JOB = {
  VerifyEmail: 'send-verify-email',
  ResetPassword: 'send-reset-password',
} as const;

export type MailJobName = (typeof MAIL_JOB)[keyof typeof MAIL_JOB];

export const MAIL_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 5000 },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 1000 },
};

export const MAIL_FALLBACK_LANGUAGE: SupportedLanguage = 'vi';

export const MAIL_ENQUEUE_TIMEOUT_MS = 3000;

export const MAIL_LAYOUT_TEMPLATE = 'layout';

export const MAIL_ACTION_TEMPLATE = 'action-link';

export const MAIL_COPY_KEYS: Record<MailJobName, string> = {
  [MAIL_JOB.VerifyEmail]: 'mail.VERIFY_EMAIL',
  [MAIL_JOB.ResetPassword]: 'mail.RESET_PASSWORD',
};

export const IMPLICIT_TLS_PORT = 465;
