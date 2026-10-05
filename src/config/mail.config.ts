import { registerAs } from '@nestjs/config';

import {
  DEFAULT_MAIL_FROM,
  DEFAULT_MAIL_FROM_NAME,
  DEFAULT_MAIL_HOST,
  DEFAULT_MAIL_PORT,
} from './config.constants';

export interface MailConfig {
  host: string;
  port: number;
  user?: string;
  password?: string;
  from: string;
  fromName: string;
}

export const MAIL_CONFIG_KEY = 'mail';

export default registerAs(MAIL_CONFIG_KEY, (): MailConfig => ({
  host: process.env.MAIL_HOST ?? DEFAULT_MAIL_HOST,
  port: parseInt(process.env.MAIL_PORT ?? String(DEFAULT_MAIL_PORT), 10),
  user: process.env.MAIL_USER || undefined,
  password: process.env.MAIL_PASSWORD || undefined,
  from: process.env.MAIL_FROM ?? DEFAULT_MAIL_FROM,
  fromName: process.env.MAIL_FROM_NAME ?? DEFAULT_MAIL_FROM_NAME,
}));
