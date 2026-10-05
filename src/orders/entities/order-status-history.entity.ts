import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { User } from '../../users/entities/user.entity';
import { OrderStatus } from '../enums/order-status.enum';
import {
  ORDER_STATUS_HISTORIES_INDEX,
  ORDER_STATUS_HISTORIES_ORDER_FK,
  ORDER_STATUS_HISTORIES_TRANSITION_CHECK,
  ORDER_STATUS_HISTORIES_USER_FK,
  REASON_MAX_LENGTH,
} from '../orders.constants';
import { Order } from './order.entity';

@Entity('order_status_histories')
@Index(ORDER_STATUS_HISTORIES_INDEX, ['orderId', 'createdAt', 'id'])
@Check(
  ORDER_STATUS_HISTORIES_TRANSITION_CHECK,
  'from_status IS NULL OR from_status <> to_status',
)
export class OrderStatusHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'order_id', type: 'uuid' })
  orderId: string;

  @ManyToOne(() => Order, (order) => order.statusHistories, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'order_id',
    foreignKeyConstraintName: ORDER_STATUS_HISTORIES_ORDER_FK,
  })
  order: Order;

  @Column({
    name: 'from_status',
    type: 'enum',
    enum: OrderStatus,
    enumName: 'order_status',
    nullable: true,
  })
  fromStatus: OrderStatus | null;

  @Column({
    name: 'to_status',
    type: 'enum',
    enum: OrderStatus,
    enumName: 'order_status',
  })
  toStatus: OrderStatus;

  @Column({ type: 'varchar', length: REASON_MAX_LENGTH, nullable: true })
  reason: string | null;

  @Column({ name: 'changed_by', type: 'uuid', nullable: true })
  changedBy: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({
    name: 'changed_by',
    foreignKeyConstraintName: ORDER_STATUS_HISTORIES_USER_FK,
  })
  changedByUser: User | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
