import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { numericTransformer } from '../../common/transformers/numeric.transformer';
import { Review } from '../../reviews/entities/review.entity';
import { User } from '../../users/entities/user.entity';
import { OrderStatus } from '../enums/order-status.enum';
import { PaymentMethod } from '../enums/payment-method.enum';
import { PaymentStatus } from '../enums/payment-status.enum';
import {
  CODE_MAX_LENGTH,
  NOTE_MAX_LENGTH,
  ORDERS_AMOUNTS_CHECK,
  ORDERS_DELIVERED_AT_CHECK,
  ORDERS_DELIVERED_AT_INDEX,
  ORDERS_DELIVERED_CONDITION,
  ORDERS_PAID_AT_CHECK,
  ORDERS_REJECT_REASON_CHECK,
  ORDERS_STATUS_LISTING_INDEX,
  ORDERS_TRANSACTION_REF_CHECK,
  ORDERS_USER_FK,
  ORDERS_USER_LISTING_INDEX,
  PAYMENT_TRANSACTION_REF_MAX_LENGTH,
  REASON_MAX_LENGTH,
  RECEIVER_NAME_MAX_LENGTH,
  RECEIVER_PHONE_MAX_LENGTH,
  SHIPPING_ADDRESS_MAX_LENGTH,
  UNIQUE_ORDERS_CODE_INDEX,
} from '../orders.constants';
import { OrderItem } from './order-item.entity';
import { OrderStatusHistory } from './order-status-history.entity';

@Entity('orders')
@Index(ORDERS_USER_LISTING_INDEX, ['userId', 'createdAt', 'id'])
@Index(ORDERS_STATUS_LISTING_INDEX, ['status', 'createdAt', 'id'])
@Index(ORDERS_DELIVERED_AT_INDEX, ['deliveredAt'], {
  where: ORDERS_DELIVERED_CONDITION,
})
@Check(
  ORDERS_AMOUNTS_CHECK,
  'subtotal >= 0 AND shipping_fee >= 0 AND total = subtotal + shipping_fee',
)
@Check(
  ORDERS_REJECT_REASON_CHECK,
  "status <> 'REJECTED' OR (reason IS NOT NULL AND char_length(reason) >= 10)",
)
@Check(
  ORDERS_DELIVERED_AT_CHECK,
  "(status = 'DELIVERED') = (delivered_at IS NOT NULL)",
)
@Check(
  ORDERS_PAID_AT_CHECK,
  "(payment_status = 'PAID') = (paid_at IS NOT NULL)",
)
@Check(
  ORDERS_TRANSACTION_REF_CHECK,
  "payment_transaction_ref IS NULL OR payment_method = 'BANK_TRANSFER'",
)
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index(UNIQUE_ORDERS_CODE_INDEX, { unique: true })
  @Column({ type: 'varchar', length: CODE_MAX_LENGTH })
  code: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, (user) => user.orders, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: ORDERS_USER_FK })
  user: User;

  @Column({
    type: 'enum',
    enum: OrderStatus,
    enumName: 'order_status',
    default: OrderStatus.Pending,
  })
  status: OrderStatus;

  @Column({
    name: 'payment_method',
    type: 'enum',
    enum: PaymentMethod,
    enumName: 'payment_method',
  })
  paymentMethod: PaymentMethod;

  @Column({
    name: 'payment_status',
    type: 'enum',
    enum: PaymentStatus,
    enumName: 'payment_status',
    default: PaymentStatus.Unpaid,
  })
  paymentStatus: PaymentStatus;

  @Column({
    name: 'payment_transaction_ref',
    type: 'varchar',
    length: PAYMENT_TRANSACTION_REF_MAX_LENGTH,
    nullable: true,
  })
  paymentTransactionRef: string | null;

  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true })
  paidAt: Date | null;

  @Column({
    name: 'receiver_name',
    type: 'varchar',
    length: RECEIVER_NAME_MAX_LENGTH,
  })
  receiverName: string;

  @Column({
    name: 'receiver_phone',
    type: 'varchar',
    length: RECEIVER_PHONE_MAX_LENGTH,
  })
  receiverPhone: string;

  @Column({
    name: 'shipping_address',
    type: 'varchar',
    length: SHIPPING_ADDRESS_MAX_LENGTH,
  })
  shippingAddress: string;

  @Column({ type: 'varchar', length: NOTE_MAX_LENGTH, nullable: true })
  note: string | null;

  @Column({ type: 'bigint', transformer: numericTransformer })
  subtotal: number;

  @Column({
    name: 'shipping_fee',
    type: 'bigint',
    default: 0,
    transformer: numericTransformer,
  })
  shippingFee: number;

  @Column({ type: 'bigint', transformer: numericTransformer })
  total: number;

  @Column({ type: 'varchar', length: REASON_MAX_LENGTH, nullable: true })
  reason: string | null;

  @Column({ name: 'delivered_at', type: 'timestamptz', nullable: true })
  deliveredAt: Date | null;

  @OneToMany(() => OrderItem, (item) => item.order)
  items?: OrderItem[];

  @OneToMany(() => OrderStatusHistory, (history) => history.order)
  statusHistories?: OrderStatusHistory[];

  @OneToMany(() => Review, (review) => review.order)
  reviews?: Review[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
