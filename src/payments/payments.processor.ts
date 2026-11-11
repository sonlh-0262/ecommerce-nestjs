import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';

import { errorMessage } from '../common/helpers/error-message';
import { RefundJobData } from './interfaces/refund-job.interface';
import { PaymentRefundsService } from './payment-refunds.service';
import { PAYMENTS_QUEUE } from './payments.constants';

@Processor(PAYMENTS_QUEUE)
export class PaymentsProcessor extends WorkerHost {
  private readonly logger = new Logger(PaymentsProcessor.name);

  constructor(private readonly refunds: PaymentRefundsService) {
    super();
  }

  async process(job: Job<RefundJobData>): Promise<void> {
    try {
      await this.refunds.complete(job.data.paymentId);
    } catch (error) {
      this.logger.error(
        `Failed ${job.name} job ${job.id} (attempt ${job.attemptsMade + 1}): ${errorMessage(error)}`,
      );

      throw error;
    }
  }
}
