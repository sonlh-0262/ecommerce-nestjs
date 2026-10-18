import { JobsOptions } from 'bullmq';

import { SupportedLanguage } from '../common/constants/languages';

export const MAIL_QUEUE = 'mail';

export const MAIL_JOB = {
  VerifyEmail: 'send-verify-email',
  ResetPassword: 'send-reset-password',
  OrderCreated: 'send-order-created',
  OrderStatusChanged: 'send-order-status-changed',
  OrderAutoCancelled: 'send-order-auto-cancelled',
  MonthlyRevenueReport: 'send-monthly-revenue-report',
} as const;

export type MailJobName = (typeof MAIL_JOB)[keyof typeof MAIL_JOB];

export type ActionMailJobName =
  typeof MAIL_JOB.VerifyEmail | typeof MAIL_JOB.ResetPassword;

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

export const MAIL_ORDER_CREATED_TEMPLATE = 'order-created';

export const MAIL_ORDER_STATUS_CHANGED_TEMPLATE = 'order-status-changed';

export const MAIL_MONTHLY_REVENUE_REPORT_TEMPLATE = 'monthly-revenue-report';

export const MAIL_CURRENCY = 'VND';

export const MAIL_ORDER_LABEL_KEYS = {
  product: 'PRODUCT',
  quantity: 'QUANTITY',
  lineTotal: 'LINE_TOTAL',
  subtotal: 'SUBTOTAL',
  shippingFee: 'SHIPPING_FEE',
  total: 'TOTAL',
  shippingAddress: 'SHIPPING_ADDRESS',
} as const;

export const MAIL_REPORT_LABEL_KEYS = {
  revenue: 'REVENUE',
  orders: 'ORDERS',
  previousRevenue: 'PREVIOUS_REVENUE',
  previousOrders: 'PREVIOUS_ORDERS',
  change: 'CHANGE',
  topProducts: 'TOP_PRODUCTS',
  product: 'PRODUCT',
  soldQuantity: 'SOLD_QUANTITY',
  productRevenue: 'PRODUCT_REVENUE',
} as const;

export const MAIL_PERCENT_MAX_FRACTION_DIGITS = 1;

export const MAIL_COPY_KEYS: Record<MailJobName, string> = {
  [MAIL_JOB.VerifyEmail]: 'mail.VERIFY_EMAIL',
  [MAIL_JOB.ResetPassword]: 'mail.RESET_PASSWORD',
  [MAIL_JOB.OrderCreated]: 'mail.ORDER_CREATED',
  [MAIL_JOB.OrderStatusChanged]: 'mail.ORDER_STATUS_CHANGED',
  [MAIL_JOB.OrderAutoCancelled]: 'mail.ORDER_AUTO_CANCELLED',
  [MAIL_JOB.MonthlyRevenueReport]: 'mail.MONTHLY_REVENUE_REPORT',
};

export const IMPLICIT_TLS_PORT = 465;
