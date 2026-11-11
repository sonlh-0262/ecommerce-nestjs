import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { PaymentProvider } from '../enums/payment-provider.enum';
import {
  EVENT_TYPE_MAX_LENGTH,
  PAYMENT_EVENTS_PAYMENT_FK,
  PAYMENT_EVENTS_PAYMENT_INDEX,
  PROVIDER_ID_MAX_LENGTH,
  UNIQUE_PAYMENT_EVENTS_PROVIDER_EVENT_INDEX,
} from '../payments.constants';
import { Payment } from './payment.entity';

@Entity('payment_events')
@Index(
  UNIQUE_PAYMENT_EVENTS_PROVIDER_EVENT_INDEX,
  ['provider', 'providerEventId'],
  { unique: true },
)
@Index(PAYMENT_EVENTS_PAYMENT_INDEX, ['paymentId'])
export class PaymentEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: PaymentProvider,
    enumName: 'payment_provider',
  })
  provider: PaymentProvider;

  @Column({
    name: 'provider_event_id',
    type: 'varchar',
    length: PROVIDER_ID_MAX_LENGTH,
  })
  providerEventId: string;

  @Column({ type: 'varchar', length: EVENT_TYPE_MAX_LENGTH })
  type: string;

  @Column({ name: 'payment_id', type: 'uuid', nullable: true })
  paymentId: string | null;

  @ManyToOne(() => Payment, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({
    name: 'payment_id',
    foreignKeyConstraintName: PAYMENT_EVENTS_PAYMENT_FK,
  })
  payment?: Payment | null;

  @Column({ type: 'jsonb' })
  payload: object;

  @CreateDateColumn({ name: 'received_at', type: 'timestamptz' })
  receivedAt: Date;
}
