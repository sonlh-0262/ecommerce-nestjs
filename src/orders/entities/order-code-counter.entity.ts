import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

import {
  ORDER_CODE_COUNTERS_SEQ_CHECK,
  ORDER_CODE_COUNTERS_SEQ_EXPRESSION,
} from '../orders.constants';

@Entity('order_code_counters')
@Check(ORDER_CODE_COUNTERS_SEQ_CHECK, ORDER_CODE_COUNTERS_SEQ_EXPRESSION)
export class OrderCodeCounter {
  @PrimaryColumn({ name: 'order_date', type: 'date' })
  orderDate: string;

  @Column({ name: 'last_seq', type: 'integer', default: 0 })
  lastSeq: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
