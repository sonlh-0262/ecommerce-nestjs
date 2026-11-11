import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import {
  DataSource,
  EntityManager,
  In,
  LessThan,
  Not,
  Repository,
} from 'typeorm';

import { errorMessage } from '../common/helpers/error-message';
import { withTimeout } from '../common/helpers/with-timeout';
import { TransactionHooks } from '../database/transaction-hooks.service';
import { Order } from '../orders/entities/order.entity';
import { PaymentMethod } from '../orders/enums/payment-method.enum';
import { PaymentStatus } from '../orders/enums/payment-status.enum';
import { findOrderForUpdate } from '../orders/order-locks';
import { Payment } from './entities/payment.entity';
import { PaymentAttemptStatus } from './enums/payment-attempt-status.enum';
import { PaymentGateway } from './interfaces/payment-gateway.interface';
import { RefundJobData } from './interfaces/refund-job.interface';
import {
  CHARGED_PAYMENT_STATUSES,
  PAYMENT_ENQUEUE_TIMEOUT_MS,
  PAYMENT_GATEWAY,
  PAYMENT_JOB,
  PAYMENTS_QUEUE,
  REFUND_KEY_PREFIX,
  REFUND_RETRY_AFTER_MS,
  REFUND_RETRY_BATCH_SIZE,
  REFUNDED_ORDER_STATUSES,
  SETTLED_JOB_STATES,
} from './payments.constants';

@Injectable()
export class PaymentRefundsService {
  private readonly logger = new Logger(PaymentRefundsService.name);

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Payment)
    private readonly paymentsRepository: Repository<Payment>,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway,
    @InjectQueue(PAYMENTS_QUEUE) private readonly queue: Queue<RefundJobData>,
    private readonly hooks: TransactionHooks,
  ) {}

  async refundOrder(manager: EntityManager, order: Order): Promise<void> {
    if (
      order.paymentMethod !== PaymentMethod.Card ||
      order.paymentStatus !== PaymentStatus.Paid
    ) {
      return;
    }

    const payment = await manager.findOne(Payment, {
      where: { orderId: order.id, status: PaymentAttemptStatus.Succeeded },
      lock: { mode: 'pessimistic_write' },
    });

    if (!payment) {
      this.logger.warn(`Order ${order.code} is paid but has no card payment`);

      return;
    }

    await this.refund(manager, payment);
  }

  async refund(manager: EntityManager, payment: Payment): Promise<void> {
    await manager.update(
      Payment,
      { id: payment.id },
      { status: PaymentAttemptStatus.RefundPending },
    );
    payment.status = PaymentAttemptStatus.RefundPending;

    await this.hooks.afterCommit(manager, async () => {
      await this.enqueue(payment.id);
    });
  }

  async complete(paymentId: string): Promise<void> {
    const payment = await this.paymentsRepository.findOneBy({ id: paymentId });

    if (payment?.status !== PaymentAttemptStatus.RefundPending) {
      return;
    }

    const { providerRefundId } = await this.gateway.refund(
      payment.providerPaymentId,
      payment.id,
    );

    await this.dataSource.transaction(async (manager) => {
      const order = await findOrderForUpdate(manager, payment.orderId);
      const locked = await manager.findOne(Payment, {
        where: { id: payment.id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!order || locked?.status !== PaymentAttemptStatus.RefundPending) {
        return;
      }

      await manager.update(
        Payment,
        { id: payment.id },
        {
          status: PaymentAttemptStatus.Refunded,
          providerRefundId,
          refundedAt: new Date(),
        },
      );

      if (await this.isFullyRefunded(manager, order, payment.id)) {
        await manager.update(
          Order,
          { id: order.id },
          { paymentStatus: PaymentStatus.Refunded },
        );
      }
    });

    this.logger.log(`Refunded payment ${payment.id} as ${providerRefundId}`);
  }

  async retryStale(now: Date): Promise<number> {
    const stale = await this.paymentsRepository.find({
      where: {
        status: PaymentAttemptStatus.RefundPending,
        updatedAt: LessThan(new Date(now.getTime() - REFUND_RETRY_AFTER_MS)),
      },
      select: { id: true },
      order: { updatedAt: 'ASC', id: 'ASC' },
      take: REFUND_RETRY_BATCH_SIZE,
    });
    let requeued = 0;

    for (const { id } of stale) {
      if (await this.requeue(id)) {
        requeued += 1;
      }
    }

    this.logger.log(
      `Requeued ${requeued} of ${stale.length} refunds stuck pending`,
    );

    return requeued;
  }

  private async isFullyRefunded(
    manager: EntityManager,
    order: Order,
    refundedId: string,
  ): Promise<boolean> {
    if (
      order.paymentStatus !== PaymentStatus.Paid ||
      !REFUNDED_ORDER_STATUSES.includes(order.status)
    ) {
      return false;
    }

    return !(await manager.exists(Payment, {
      where: {
        orderId: order.id,
        id: Not(refundedId),
        status: In(CHARGED_PAYMENT_STATUSES),
      },
    }));
  }

  private async requeue(paymentId: string): Promise<boolean> {
    try {
      const job = await this.queue.getJob(jobIdOf(paymentId));

      if (job) {
        if (!SETTLED_JOB_STATES.includes(await job.getState())) {
          return false;
        }

        await job.remove();
      }
    } catch (error) {
      this.logger.error(
        `Could not inspect the refund of payment ${paymentId}: ${errorMessage(error)}`,
      );

      return false;
    }

    return this.enqueue(paymentId);
  }

  private async enqueue(paymentId: string): Promise<boolean> {
    try {
      await withTimeout(
        this.queue.add(
          PAYMENT_JOB.Refund,
          { paymentId },
          { jobId: jobIdOf(paymentId) },
        ),
        PAYMENT_ENQUEUE_TIMEOUT_MS,
      );
      this.logger.log(`Queued the refund of payment ${paymentId}`);

      return true;
    } catch (error) {
      this.logger.error(
        `Could not queue the refund of payment ${paymentId}: ${errorMessage(error)}`,
      );

      return false;
    }
  }
}

function jobIdOf(paymentId: string): string {
  return `${REFUND_KEY_PREFIX}${paymentId}`;
}
