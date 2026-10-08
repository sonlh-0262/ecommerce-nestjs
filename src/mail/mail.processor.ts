import { MailerService } from '@nestjs-modules/mailer';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import { I18nService } from 'nestjs-i18n';

import { MAIL_CONFIG_KEY, MailConfig } from '../config/mail.config';
import { MailTranslator } from './interfaces/mail-content.interface';
import { MailJobPayloadMap } from './interfaces/mail-job.interface';
import { composeMail } from './mail-content';
import { resolveMailLanguage } from './mail-language';
import { MAIL_QUEUE, MailJobName } from './mail.constants';

export type MailJob = Job<MailJobPayloadMap[MailJobName], void, MailJobName>;

@Processor(MAIL_QUEUE)
export class MailProcessor extends WorkerHost {
  private readonly logger = new Logger(MailProcessor.name);
  private readonly sender: { name: string; address: string };

  constructor(
    private readonly mailer: MailerService,
    private readonly i18n: I18nService,
    configService: ConfigService,
  ) {
    super();

    const config = configService.getOrThrow<MailConfig>(MAIL_CONFIG_KEY);

    this.sender = { name: config.fromName, address: config.from };
  }

  async process(job: MailJob): Promise<void> {
    try {
      const { subject, template, context } = composeMail(
        job.name,
        job.data,
        this.translator(job.data.lang),
      );

      await this.mailer.sendMail({
        from: this.sender,
        to: job.data.to,
        subject,
        template,
        context: { ...context, appName: this.sender.name },
      });

      this.logger.log(`Sent ${job.name} job ${job.id}`);
    } catch (error) {
      this.logger.error(
        `Failed ${job.name} job ${job.id} (attempt ${job.attemptsMade + 1}): ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      throw error;
    }
  }

  private translator(lang: string): MailTranslator {
    const language = resolveMailLanguage(lang);

    return (key, args) => this.i18n.t(key, { lang: language, args });
  }
}
