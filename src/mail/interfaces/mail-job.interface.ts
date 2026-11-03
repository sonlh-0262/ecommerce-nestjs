import { SupportedLanguage } from '../../common/constants/languages';
import { OrderStatus } from '../../orders/enums/order-status.enum';
import { MAIL_JOB, MailJobName } from '../mail.constants';

export interface BaseMailJob {
  to: string;
  lang: SupportedLanguage;
}

export interface GreetedMailJob extends BaseMailJob {
  fullName: string | null;
}

export interface ActionMailJob extends GreetedMailJob {
  actionUrl: string;
  expiresInMinutes: number;
}

export interface OrderCreatedMailItem {
  name: string;
  quantity: number;
  lineTotal: number;
}

export interface OrderCreatedMailJob extends GreetedMailJob {
  orderCode: string;
  items: OrderCreatedMailItem[];
  subtotal: number;
  shippingFee: number;
  total: number;
  shippingAddress: string;
}

export interface OrderStatusChangedMailJob extends GreetedMailJob {
  orderCode: string;
  status: OrderStatus;
  reason: string | null;
}

export interface OrderAutoCancelledMailJob extends GreetedMailJob {
  orderCode: string;
  days: number;
}

export interface MonthlyReportTotals {
  orders: number;
  revenue: number;
}

export interface MonthlyReportProduct {
  name: string;
  soldQuantity: number;
  revenue: number;
}

export interface MonthlyRevenueReportMailJob extends GreetedMailJob {
  year: number;
  month: number;
  current: MonthlyReportTotals;
  previous: MonthlyReportTotals;
  topProducts: MonthlyReportProduct[];
}

export interface MailJobPayloadMap {
  [MAIL_JOB.VerifyEmail]: ActionMailJob;
  [MAIL_JOB.ResetPassword]: ActionMailJob;
  [MAIL_JOB.OrderCreated]: OrderCreatedMailJob;
  [MAIL_JOB.OrderStatusChanged]: OrderStatusChangedMailJob;
  [MAIL_JOB.OrderAutoCancelled]: OrderAutoCancelledMailJob;
  [MAIL_JOB.MonthlyRevenueReport]: MonthlyRevenueReportMailJob;
}

export type MailJobPayload<T extends MailJobName> = MailJobPayloadMap[T];

export type MailJobInput<T extends MailJobName> = Omit<
  MailJobPayload<T>,
  'lang'
> &
  Partial<Pick<BaseMailJob, 'lang'>>;
