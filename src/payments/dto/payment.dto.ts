import { ApiProperty } from '@nestjs/swagger';

import { paginated } from '../../common/helpers/paginated';
import { Payment } from '../entities/payment.entity';
import { PaymentAttemptStatus } from '../enums/payment-attempt-status.enum';
import { PaymentProvider } from '../enums/payment-provider.enum';
import { PaymentPage } from '../interfaces/payment-page.interface';
import { isOpenPayment } from '../payment-status.machine';

export class PaymentDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: PaymentProvider, enumName: 'PaymentProvider' })
  provider: PaymentProvider;

  @ApiProperty({
    description: 'The intent id at the provider.',
    example: 'mock_pi_3f9a1c0d2b7e4a5f6c8d9e0a',
  })
  providerPaymentId: string;

  @ApiProperty({
    enum: PaymentAttemptStatus,
    enumName: 'PaymentAttemptStatus',
  })
  status: PaymentAttemptStatus;

  @ApiProperty({ description: 'In VND.', example: 330000 })
  amount: number;

  @ApiProperty({ example: 'VND' })
  currency: string;

  @ApiProperty({
    nullable: true,
    description:
      'Hand it to Stripe.js or to the simulator to confirm the card. ' +
      'null once the attempt is over.',
    example: 'mock_pi_3f9a1c0d2b7e4a5f6c8d9e0a_secret_9b8a7c6d5e4f3a2b1c0d',
  })
  clientSecret: string | null;

  @ApiProperty({ nullable: true, example: 'visa' })
  cardBrand: string | null;

  @ApiProperty({ nullable: true, example: '4242' })
  cardLast4: string | null;

  @ApiProperty({ nullable: true, example: null })
  failureCode: string | null;

  @ApiProperty({ nullable: true, example: null })
  failureMessage: string | null;

  @ApiProperty({ example: '2026-11-10T03:00:00.000Z' })
  createdAt: string;

  @ApiProperty({ nullable: true, example: null })
  succeededAt: string | null;

  @ApiProperty({ nullable: true, example: null })
  refundedAt: string | null;
}

export class PaymentResponseDto {
  @ApiProperty({ type: PaymentDto })
  payment: PaymentDto;
}

export class PaymentsResponseDto {
  @ApiProperty({ type: [PaymentDto], description: 'Newest first.' })
  payments: PaymentDto[];

  @ApiProperty({ description: 'Attempts of the order.', example: 2 })
  paymentsCount: number;
}

function toPaymentDto(payment: Payment): PaymentDto {
  return {
    id: payment.id,
    provider: payment.provider,
    providerPaymentId: payment.providerPaymentId,
    status: payment.status,
    amount: payment.amount,
    currency: payment.currency,
    clientSecret: isOpenPayment(payment.status) ? payment.clientSecret : null,
    cardBrand: payment.cardBrand,
    cardLast4: payment.cardLast4,
    failureCode: payment.failureCode,
    failureMessage: payment.failureMessage,
    createdAt: payment.createdAt.toISOString(),
    succeededAt: payment.succeededAt?.toISOString() ?? null,
    refundedAt: payment.refundedAt?.toISOString() ?? null,
  };
}

export function toPaymentResponse(payment: Payment): PaymentResponseDto {
  return { payment: toPaymentDto(payment) };
}

export function toPaymentsResponse(page: PaymentPage): PaymentsResponseDto {
  return paginated('payments', page.payments.map(toPaymentDto), page.total);
}
