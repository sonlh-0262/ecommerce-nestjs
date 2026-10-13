import { SupportedLanguage } from '../../common/constants/languages';
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

export interface MailJobPayloadMap {
  [MAIL_JOB.VerifyEmail]: ActionMailJob;
  [MAIL_JOB.ResetPassword]: ActionMailJob;
  [MAIL_JOB.OrderCreated]: OrderCreatedMailJob;
}

export type MailJobPayload<T extends MailJobName> = MailJobPayloadMap[T];

export type MailJobInput<T extends MailJobName> = Omit<
  MailJobPayload<T>,
  'lang'
>;
