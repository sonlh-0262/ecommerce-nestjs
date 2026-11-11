import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { DataSource, EntityManager } from 'typeorm';

import { Order } from '../orders/entities/order.entity';
import { PaymentStatus } from '../orders/enums/payment-status.enum';
import { findOrderForUpdate } from '../orders/order-locks';
import { ORDER_PAYABLE_STATUSES } from '../orders/orders.constants';
import { PaymentEvent } from './entities/payment-event.entity';
import { Payment } from './entities/payment.entity';
import { PaymentAttemptStatus } from './enums/payment-attempt-status.enum';
import { PaymentProvider } from './enums/payment-provider.enum';
import { InvalidWebhookError } from './gateways/invalid-webhook.error';
import {
  GatewayEvent,
  PaymentGateway,
} from './interfaces/payment-gateway.interface';
import { InsertedEvent } from './interfaces/inserted-event.interface';
import { WebhookReceipt } from './interfaces/webhook-receipt.interface';
import { PaymentRefundsService } from './payment-refunds.service';
import { canMovePayment } from './payment-status.machine';
import {
  CARD_BRAND_MAX_LENGTH,
  FAILURE_CODE_MAX_LENGTH,
  FAILURE_MESSAGE_MAX_LENGTH,
  PAYMENT_GATEWAY,
} from './payments.constants';

@Injectable()
export class PaymentWebhooksService {
  private readonly logger = new Logger(PaymentWebhooksService.name);

  constructor(
    private readonly dataSource: DataSource,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway,
    private readonly refunds: PaymentRefundsService,
    private readonly i18n: I18nService,
  ) {}

  async receive(
    provider: PaymentProvider,
    rawBody: Buffer | undefined,
    signature: string | undefined,
  ): Promise<WebhookReceipt> {
    if (provider !== this.gateway.provider) {
      throw new NotFoundException(this.i18n.t('payments.WEBHOOK_NOT_FOUND'));
    }

    const event = this.parse(rawBody, signature);

    return this.dataSource.transaction(async (manager) => {
      const recorded = await this.record(manager, event);

      if (!recorded) {
        this.logger.log(`Skipped duplicate ${provider} event ${event.id}`);

        return { id: event.id, duplicate: true };
      }

      const payment = await this.apply(manager, event);

      if (payment) {
        await manager.update(
          PaymentEvent,
          { id: recorded.id },
          { paymentId: payment.id },
        );
      }

      return { id: event.id, duplicate: false };
    });
  }

  private parse(
    rawBody: Buffer | undefined,
    signature: string | undefined,
  ): GatewayEvent {
    try {
      if (!rawBody || !signature) {
        throw new InvalidWebhookError('body or signature missing');
      }

      return this.gateway.parseEvent(rawBody, signature);
    } catch (error) {
      if (!(error instanceof InvalidWebhookError)) {
        throw error;
      }

      this.logger.warn(error.message);

      throw new BadRequestException(this.i18n.t('payments.INVALID_WEBHOOK'));
    }
  }

  private async record(
    manager: EntityManager,
    event: GatewayEvent,
  ): Promise<InsertedEvent | undefined> {
    const result = await manager
      .createQueryBuilder()
      .insert()
      .into(PaymentEvent)
      .values({
        provider: this.gateway.provider,
        providerEventId: event.id,
        type: event.type,
        payload: event.payload,
      })
      .orIgnore()
      .returning(['id'])
      .execute();

    return (result.raw as InsertedEvent[])[0];
  }

  private async apply(
    manager: EntityManager,
    event: GatewayEvent,
  ): Promise<Payment | null> {
    if (!event.providerPaymentId || !event.status) {
      return null;
    }

    const target = await manager.findOne(Payment, {
      where: {
        provider: this.gateway.provider,
        providerPaymentId: event.providerPaymentId,
      },
      select: { id: true, orderId: true },
    });

    if (!target) {
      this.logger.warn(
        `Event ${event.id} is for unknown intent ${event.providerPaymentId}`,
      );

      return null;
    }

    const order = (await findOrderForUpdate(manager, target.orderId)) as Order;
    const payment = (await manager.findOne(Payment, {
      where: { id: target.id },
      lock: { mode: 'pessimistic_write' },
    })) as Payment;

    if (!canMovePayment(payment.status, event.status)) {
      this.logger.log(
        `Ignored ${event.type} for payment ${payment.id} in ${payment.status}`,
      );

      return payment;
    }

    const patch = patchFor(event, event.status);

    await manager.update(Payment, { id: payment.id }, patch);
    Object.assign(payment, patch);

    if (payment.status === PaymentAttemptStatus.Succeeded) {
      await this.settle(manager, order, payment);
    }

    this.logger.log(
      `Payment ${payment.id} of ${order.code} is ${payment.status}`,
    );

    return payment;
  }

  private async settle(
    manager: EntityManager,
    order: Order,
    payment: Payment,
  ): Promise<void> {
    if (
      order.paymentStatus === PaymentStatus.Unpaid &&
      ORDER_PAYABLE_STATUSES.includes(order.status)
    ) {
      await manager.update(
        Order,
        { id: order.id },
        { paymentStatus: PaymentStatus.Paid, paidAt: payment.succeededAt },
      );

      return;
    }

    this.logger.warn(
      `Payment ${payment.id} succeeded on ${order.code} (${order.status}, ${order.paymentStatus}), refunding it`,
    );
    await this.refunds.refund(manager, payment);
  }
}

function patchFor(
  event: GatewayEvent,
  status: PaymentAttemptStatus,
): Partial<Payment> {
  const patch: Partial<Payment> = { status };

  if (event.card) {
    patch.cardBrand = event.card.brand.slice(0, CARD_BRAND_MAX_LENGTH);
    patch.cardLast4 = event.card.last4;
  }

  if (status === PaymentAttemptStatus.Failed && event.failure) {
    patch.failureCode = event.failure.code.slice(0, FAILURE_CODE_MAX_LENGTH);
    patch.failureMessage = event.failure.message.slice(
      0,
      FAILURE_MESSAGE_MAX_LENGTH,
    );
  }

  if (status === PaymentAttemptStatus.Succeeded) {
    patch.succeededAt = new Date();
    patch.failureCode = null;
    patch.failureMessage = null;
  }

  return patch;
}
