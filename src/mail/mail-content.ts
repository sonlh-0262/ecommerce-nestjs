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
  MonthlyRevenueReportMailJob,
  OrderAutoCancelledMailJob,
  OrderCreatedMailJob,
  OrderStatusChangedMailJob,
} from './interfaces/mail-job.interface';
import {
  MAIL_ACTION_TEMPLATE,
  MAIL_COPY_KEYS,
  MAIL_CURRENCY,
  MAIL_JOB,
  MAIL_MONTHLY_REVENUE_REPORT_TEMPLATE,
  MAIL_ORDER_CREATED_TEMPLATE,
  MAIL_ORDER_LABEL_KEYS,
  MAIL_ORDER_STATUS_CHANGED_TEMPLATE,
  MAIL_PERCENT_MAX_FRACTION_DIGITS,
  MAIL_REPORT_LABEL_KEYS,
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
  [MAIL_JOB.OrderAutoCancelled]: composeOrderAutoCancelledMail,
  [MAIL_JOB.MonthlyRevenueReport]: composeMonthlyRevenueReportMail,
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

function formatMonth(
  year: number,
  month: number,
  lang: SupportedLanguage,
): string {
  return new Intl.DateTimeFormat(lang, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1)));
}

function formatChange(
  current: number,
  previous: number,
  lang: SupportedLanguage,
): string {
  return new Intl.NumberFormat(lang, {
    style: 'percent',
    signDisplay: 'exceptZero',
    maximumFractionDigits: MAIL_PERCENT_MAX_FRACTION_DIGITS,
  }).format((current - previous) / previous);
}

function labelsOf(
  copy: string,
  keys: Record<string, string>,
  t: MailTranslator,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(keys).map(([label, key]) => [label, t(`${copy}.${key}`)]),
  );
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
      labels: labelsOf(copy, MAIL_ORDER_LABEL_KEYS, t),
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

function composeOrderAutoCancelledMail(
  copy: string,
  job: OrderAutoCancelledMailJob,
  t: MailTranslator,
): MailContent {
  const subject = t(`${copy}.SUBJECT`, { code: job.orderCode });

  return {
    subject,
    template: MAIL_ORDER_STATUS_CHANGED_TEMPLATE,
    context: {
      ...frameOf(subject, job, t),
      intro: t(`${copy}.INTRO`, { code: job.orderCode, days: job.days }),
    },
  };
}

function composeMonthlyRevenueReportMail(
  copy: string,
  job: MonthlyRevenueReportMailJob,
  t: MailTranslator,
): MailContent {
  const period = formatMonth(job.year, job.month, job.lang);
  const subject = t(`${copy}.SUBJECT`, { period });
  const money = (amount: number) => formatMoney(amount, job.lang);

  return {
    subject,
    template: MAIL_MONTHLY_REVENUE_REPORT_TEMPLATE,
    context: {
      ...frameOf(subject, job, t),
      intro: t(`${copy}.INTRO`, { period }),
      labels: labelsOf(copy, MAIL_REPORT_LABEL_KEYS, t),
      revenue: money(job.current.revenue),
      orders: job.current.orders,
      previousRevenue: money(job.previous.revenue),
      previousOrders: job.previous.orders,
      change:
        job.previous.revenue === 0
          ? t(`${copy}.NO_COMPARISON`)
          : formatChange(job.current.revenue, job.previous.revenue, job.lang),
      topProducts: job.topProducts.map((product) => ({
        name: product.name,
        soldQuantity: product.soldQuantity,
        revenue: money(product.revenue),
      })),
      noSales: t(`${copy}.NO_SALES`),
    },
  };
}
