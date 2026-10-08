import { MailerModule, MailerOptions } from '@nestjs-modules/mailer';
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as path from 'path';

import { MAIL_CONFIG_KEY, MailConfig } from '../config/mail.config';
import { HandlebarsTemplateAdapter } from './handlebars.adapter';
import {
  IMPLICIT_TLS_PORT,
  MAIL_JOB_OPTIONS,
  MAIL_QUEUE,
} from './mail.constants';
import { MailQueueService } from './mail-queue.service';
import { MailProcessor } from './mail.processor';

@Module({
  imports: [
    BullModule.registerQueue({
      name: MAIL_QUEUE,
      defaultJobOptions: MAIL_JOB_OPTIONS,
    }),
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService): MailerOptions => {
        const config = configService.getOrThrow<MailConfig>(MAIL_CONFIG_KEY);

        return {
          transport: {
            host: config.host,
            port: config.port,
            secure: config.port === IMPLICIT_TLS_PORT,
            auth: config.user
              ? { user: config.user, pass: config.password }
              : undefined,
          },
          template: {
            dir: path.join(__dirname, 'templates'),
            adapter: new HandlebarsTemplateAdapter(),
          },
        };
      },
    }),
  ],
  providers: [MailQueueService, MailProcessor],
  exports: [MailQueueService],
})
export class MailModule {}
