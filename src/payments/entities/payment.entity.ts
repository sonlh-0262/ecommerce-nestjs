import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

import { numericTransformer } from '../../common/transformers/numeric.transformer';
import { Order } from '../../orders/entities/order.entity';
import { PaymentAttemptStatus } from '../enums/payment-attempt-status.enum';
import { PaymentProvider } from '../enums/payment-provider.enum';
import {
  CARD_BRAND_MAX_LENGTH,
  CARD_LAST4_LENGTH,
  CLIENT_SECRET_MAX_LENGTH,
  CURRENCY_LENGTH,
  FAILURE_CODE_MAX_LENGTH,
  FAILURE_MESSAGE_MAX_LENGTH,
  PAYMENTS_AMOUNT_CHECK,
  PAYMENTS_OPEN_CONDITION,
  PAYMENTS_ORDER_FK,
  PAYMENTS_ORDER_LISTING_INDEX,
  PAYMENTS_REFUNDED_AT_CHECK,
  PAYMENTS_REFUNDED_AT_EXPRESSION,
  PAYMENTS_SUCCEEDED_AT_CHECK,
  PAYMENTS_SUCCEEDED_AT_EXPRESSION,
  PROVIDER_ID_MAX_LENGTH,
  UNIQUE_PAYMENTS_OPEN_PER_ORDER_INDEX,
  UNIQUE_PAYMENTS_PROVIDER_ID_INDEX,
} from '../payments.constants';

@Entity('payments')
@Index(UNIQUE_PAYMENTS_PROVIDER_ID_INDEX, ['provider', 'providerPaymentId'], {
  unique: true,
})
@Index(UNIQUE_PAYMENTS_OPEN_PER_ORDER_INDEX, ['orderId'], {
  unique: true,
  where: PAYMENTS_OPEN_CONDITION,
})
@Index(PAYMENTS_ORDER_LISTING_INDEX, ['orderId', 'createdAt', 'id'])
@Check(PAYMENTS_AMOUNT_CHECK, 'amount > 0')
@Check(PAYMENTS_SUCCEEDED_AT_CHECK, PAYMENTS_SUCCEEDED_AT_EXPRESSION)
@Check(PAYMENTS_REFUNDED_AT_CHECK, PAYMENTS_REFUNDED_AT_EXPRESSION)
export class Payment {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ name: 'order_id', type: 'uuid' })
  orderId: string;

  @ManyToOne(() => Order, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'order_id', foreignKeyConstraintName: PAYMENTS_ORDER_FK })
  order?: Order;

  @Column({
    type: 'enum',
    enum: PaymentProvider,
    enumName: 'payment_provider',
  })
  provider: PaymentProvider;

  @Column({
    name: 'provider_payment_id',
    type: 'varchar',
    length: PROVIDER_ID_MAX_LENGTH,
  })
  providerPaymentId: string;

  @Column({
    name: 'client_secret',
    type: 'varchar',
    length: CLIENT_SECRET_MAX_LENGTH,
  })
  clientSecret: string;

  @Column({
    type: 'enum',
    enum: PaymentAttemptStatus,
    enumName: 'payment_attempt_status',
    default: PaymentAttemptStatus.Pending,
  })
  status: PaymentAttemptStatus;

  @Column({ type: 'bigint', transformer: numericTransformer })
  amount: number;

  @Column({ type: 'char', length: CURRENCY_LENGTH })
  currency: string;

  @Column({
    name: 'card_brand',
    type: 'varchar',
    length: CARD_BRAND_MAX_LENGTH,
    nullable: true,
  })
  cardBrand: string | null;

  @Column({
    name: 'card_last4',
    type: 'char',
    length: CARD_LAST4_LENGTH,
    nullable: true,
  })
  cardLast4: string | null;

  @Column({
    name: 'failure_code',
    type: 'varchar',
    length: FAILURE_CODE_MAX_LENGTH,
    nullable: true,
  })
  failureCode: string | null;

  @Column({
    name: 'failure_message',
    type: 'varchar',
    length: FAILURE_MESSAGE_MAX_LENGTH,
    nullable: true,
  })
  failureMessage: string | null;

  @Column({
    name: 'provider_refund_id',
    type: 'varchar',
    length: PROVIDER_ID_MAX_LENGTH,
    nullable: true,
  })
  providerRefundId: string | null;

  @Column({ name: 'succeeded_at', type: 'timestamptz', nullable: true })
  succeededAt: Date | null;

  @Column({ name: 'refunded_at', type: 'timestamptz', nullable: true })
  refundedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
