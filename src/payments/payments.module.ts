import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Order } from '../orders/entities/order.entity';
import { PaymentEvent } from './entities/payment-event.entity';
import { Payment } from './entities/payment.entity';
import { paymentGatewayProvider } from './gateways/payment-gateway.provider';
import { OrderPaymentsController } from './order-payments.controller';
import { PaymentRefundsService } from './payment-refunds.service';
import { PaymentWebhooksController } from './payment-webhooks.controller';
import { PaymentWebhooksService } from './payment-webhooks.service';
import { PAYMENT_JOB_OPTIONS, PAYMENTS_QUEUE } from './payments.constants';
import { PaymentsProcessor } from './payments.processor';
import { PaymentsScheduler } from './payments.scheduler';
import { PaymentsService } from './payments.service';
import { MockIntentStore } from './simulator/mock-intent.store';
import { MockPaymentGateway } from './simulator/mock-payment.gateway';
import { PaymentSimulatorController } from './simulator/payment-simulator.controller';
import { PaymentSimulatorService } from './simulator/payment-simulator.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment, PaymentEvent, Order]),
    BullModule.registerQueue({
      name: PAYMENTS_QUEUE,
      defaultJobOptions: PAYMENT_JOB_OPTIONS,
    }),
  ],
  controllers: [
    OrderPaymentsController,
    PaymentWebhooksController,
    PaymentSimulatorController,
  ],
  providers: [
    MockIntentStore,
    MockPaymentGateway,
    paymentGatewayProvider,
    PaymentsService,
    PaymentWebhooksService,
    PaymentRefundsService,
    PaymentsProcessor,
    PaymentsScheduler,
    PaymentSimulatorService,
  ],
  exports: [PaymentRefundsService, PaymentsScheduler],
})
export class PaymentsModule {}
