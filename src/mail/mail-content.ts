import { UnrecoverableError } from 'bullmq';

import { SupportedLanguage } from '../common/constants/languages';
import { MINUTES_PER_HOUR } from '../common/constants/time';
import {
  MailContent,
  MailTranslator,
} from './interfaces/mail-content.interface';
import {
  ActionMailJob,
  GreetedMailJob,
  MailJobPayloadMap,
  OrderCreatedMailJob,
  OrderStatusChangedMailJob,
} from './interfaces/mail-job.interface';
import {
  MAIL_ACTION_TEMPLATE,
  MAIL_COPY_KEYS,
  MAIL_CURRENCY,
  MAIL_JOB,
  MAIL_ORDER_CREATED_TEMPLATE,
  MAIL_ORDER_LABEL_KEYS,
  MAIL_ORDER_STATUS_CHANGED_TEMPLATE,
  MailJobName,
} from './mail.constants';

type MailComposer<T extends MailJobName> = (
  copy: string,
  job: MailJobPayloadMap[T],
  t: MailTranslator,
) => MailContent;

const MAIL_COMPOSERS: { [K in MailJobName]: MailComposer<K> } = {
  [MAIL_JOB.VerifyEmail]: composeActionMail,
  [MAIL_JOB.ResetPassword]: composeActionMail,
  [MAIL_JOB.OrderCreated]: composeOrderCreatedMail,
  [MAIL_JOB.OrderStatusChanged]: composeOrderStatusChangedMail,
};

export function composeMail<T extends MailJobName>(
  name: T,
  job: MailJobPayloadMap[T],
  t: MailTranslator,
): MailContent {
  const compose = MAIL_COMPOSERS[name] as MailComposer<T> | undefined;

  if (!compose) {
    throw new UnrecoverableError(`Unknown mail job "${String(name)}"`);
  }

  return compose(MAIL_COPY_KEYS[name], job, t);
}

function frameOf(
  subject: string,
  job: GreetedMailJob,
  t: MailTranslator,
): Record<string, unknown> {
  return {
    lang: job.lang,
    title: subject,
    greeting: t('mail.GREETING', { name: job.fullName?.trim() || job.to }),
    footer: t('mail.FOOTER'),
  };
}

function composeActionMail(
  copy: string,
  job: ActionMailJob,
  t: MailTranslator,
): MailContent {
  const subject = t(`${copy}.SUBJECT`);

  return {
    subject,
    template: MAIL_ACTION_TEMPLATE,
    context: {
      ...frameOf(subject, job, t),
      intro: t(`${copy}.INTRO`),
      actionLabel: t(`${copy}.ACTION`),
      actionUrl: job.actionUrl,
      expiry: t(`${copy}.EXPIRY`, {
        duration: formatDuration(job.expiresInMinutes, job.lang),
      }),
      fallbackLink: t('mail.FALLBACK_LINK'),
      ignoreNotice: t('mail.IGNORE_IF_NOT_YOU'),
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

function formatMoney(amount: number, lang: SupportedLanguage): string {
  return new Intl.NumberFormat(lang, {
    style: 'currency',
    currency: MAIL_CURRENCY,
  }).format(amount);
}

function composeOrderCreatedMail(
  copy: string,
  job: OrderCreatedMailJob,
  t: MailTranslator,
): MailContent {
  const subject = t(`${copy}.SUBJECT`, { code: job.orderCode });
  const money = (amount: number) => formatMoney(amount, job.lang);

  return {
    subject,
    template: MAIL_ORDER_CREATED_TEMPLATE,
    context: {
      ...frameOf(subject, job, t),
      intro: t(`${copy}.INTRO`, { code: job.orderCode }),
      labels: Object.fromEntries(
        Object.entries(MAIL_ORDER_LABEL_KEYS).map(([label, key]) => [
          label,
          t(`${copy}.${key}`),
        ]),
      ),
      items: job.items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        lineTotal: money(item.lineTotal),
      })),
      subtotal: money(job.subtotal),
      shippingFee: money(job.shippingFee),
      total: money(job.total),
      shippingAddress: job.shippingAddress,
    },
  };
}

function composeOrderStatusChangedMail(
  copy: string,
  job: OrderStatusChangedMailJob,
  t: MailTranslator,
): MailContent {
  const statusCopy = `${copy}.${job.status}`;
  const subject = t(`${statusCopy}.SUBJECT`, { code: job.orderCode });

  return {
    subject,
    template: MAIL_ORDER_STATUS_CHANGED_TEMPLATE,
    context: {
      ...frameOf(subject, job, t),
      intro: t(`${statusCopy}.INTRO`, { code: job.orderCode }),
      reasonLabel: t(`${copy}.REASON`),
      reason: job.reason,
    },
  };
}
