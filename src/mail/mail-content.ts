import { UnrecoverableError } from 'bullmq';

import { SupportedLanguage } from '../common/constants/languages';
import { MINUTES_PER_HOUR } from '../common/constants/time';
import {
  MailContent,
  MailTranslator,
} from './interfaces/mail-content.interface';
import { MailJobPayloadMap } from './interfaces/mail-job.interface';
import {
  MAIL_ACTION_TEMPLATE,
  MAIL_COPY_KEYS,
  MailJobName,
} from './mail.constants';

export function composeMail<T extends MailJobName>(
  name: T,
  job: MailJobPayloadMap[T],
  t: MailTranslator,
): MailContent {
  const copy = MAIL_COPY_KEYS[name];

  if (!copy) {
    throw new UnrecoverableError(`Unknown mail job "${String(name)}"`);
  }

  const subject = t(`${copy}.SUBJECT`);

  return {
    subject,
    template: MAIL_ACTION_TEMPLATE,
    context: {
      lang: job.lang,
      title: subject,
      greeting: t('mail.GREETING', { name: job.fullName?.trim() || job.to }),
      intro: t(`${copy}.INTRO`),
      actionLabel: t(`${copy}.ACTION`),
      actionUrl: job.actionUrl,
      expiry: t(`${copy}.EXPIRY`, {
        duration: formatDuration(job.expiresInMinutes, job.lang),
      }),
      fallbackLink: t('mail.FALLBACK_LINK'),
      ignoreNotice: t('mail.IGNORE_IF_NOT_YOU'),
      footer: t('mail.FOOTER'),
    },
  };
}

export function formatDuration(
  minutes: number,
  lang: SupportedLanguage,
): string {
  const [value, unit] =
    minutes % MINUTES_PER_HOUR === 0
      ? [minutes / MINUTES_PER_HOUR, 'hour']
      : [minutes, 'minute'];

  return new Intl.NumberFormat(lang, {
    style: 'unit',
    unit,
    unitDisplay: 'long',
  }).format(value);
}
