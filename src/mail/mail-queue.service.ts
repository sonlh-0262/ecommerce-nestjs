import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { I18nContext } from 'nestjs-i18n';

import { withTimeout } from '../common/helpers/with-timeout';
import { MailJobInput, MailJobPayload } from './interfaces/mail-job.interface';
import { resolveMailLanguage } from './mail-language';
import {
  MAIL_ENQUEUE_TIMEOUT_MS,
  MAIL_QUEUE,
  MailJobName,
} from './mail.constants';

@Injectable()
export class MailQueueService {
  private readonly logger = new Logger(MailQueueService.name);

  constructor(@InjectQueue(MAIL_QUEUE) private readonly queue: Queue) {}

  async enqueue<T extends MailJobName>(
    name: T,
    payload: MailJobInput<T>,
  ): Promise<void> {
    const data = {
      ...payload,
      lang: resolveMailLanguage(I18nContext.current()?.lang),
    } as MailJobPayload<T>;

    try {
      const job = await withTimeout(
        this.queue.add(name, data),
        MAIL_ENQUEUE_TIMEOUT_MS,
        `timed out after ${MAIL_ENQUEUE_TIMEOUT_MS}ms`,
      );

      this.logger.log(`Queued ${name} job ${job.id}`);
    } catch (error) {
      this.logger.error(
        `Could not queue ${name}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
