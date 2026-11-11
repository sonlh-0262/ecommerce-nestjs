import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';

import { RefundJobData } from './interfaces/refund-job.interface';
import { PaymentRefundsService } from './payment-refunds.service';
import { PAYMENT_JOB } from './payments.constants';
import { PaymentsProcessor } from './payments.processor';

describe('PaymentsProcessor', () => {
  const refunds = { complete: jest.fn() };
  const processor = new PaymentsProcessor(
    refunds as unknown as PaymentRefundsService,
  );
  const job = {
    id: 'refund-pay1',
    name: PAYMENT_JOB.Refund,
    attemptsMade: 0,
    data: { paymentId: 'pay1' },
  } as Job<RefundJobData>;

  let error: jest.SpyInstance;

  beforeEach(() => {
    error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('completes the refund of the job payment', async () => {
    await processor.process(job);

    expect(refunds.complete).toHaveBeenCalledWith('pay1');
  });

  it('logs and rethrows so BullMQ retries with backoff', async () => {
    refunds.complete.mockRejectedValue(new Error('gateway down'));

    await expect(processor.process(job)).rejects.toThrow('gateway down');
    expect(error).toHaveBeenCalledWith(expect.stringContaining('attempt 1'));
  });
});
