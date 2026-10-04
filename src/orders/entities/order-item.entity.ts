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

import { numericTransformer } from '../../common/transformers/numeric.transformer';
import {
  NAME_MAX_LENGTH as PRODUCT_NAME_MAX_LENGTH,
  SLUG_MAX_LENGTH as PRODUCT_SLUG_MAX_LENGTH,
} from '../../products/products.constants';
import { Product } from '../../products/entities/product.entity';
import {
  ORDER_ITEMS_LINE_TOTAL_CHECK,
  ORDER_ITEMS_ORDER_FK,
  ORDER_ITEMS_PRODUCT_FK,
  ORDER_ITEMS_PRODUCT_INDEX,
  ORDER_ITEMS_QUANTITY_CHECK,
  ORDER_ITEMS_UNIT_PRICE_CHECK,
  UNIQUE_ORDER_ITEMS_ORDER_PRODUCT_INDEX,
} from '../orders.constants';
import { Order } from './order.entity';

@Entity('order_items')
@Index(UNIQUE_ORDER_ITEMS_ORDER_PRODUCT_INDEX, ['orderId', 'productId'], {
  unique: true,
})
@Index(ORDER_ITEMS_PRODUCT_INDEX, ['productId'])
@Check(ORDER_ITEMS_QUANTITY_CHECK, 'quantity > 0')
@Check(ORDER_ITEMS_UNIT_PRICE_CHECK, 'unit_price >= 0')
@Check(ORDER_ITEMS_LINE_TOTAL_CHECK, 'line_total = unit_price * quantity')
export class OrderItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'order_id', type: 'uuid' })
  orderId: string;

  @ManyToOne(() => Order, (order) => order.items, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'order_id',
    foreignKeyConstraintName: ORDER_ITEMS_ORDER_FK,
  })
  order: Order;

  @Column({ name: 'product_id', type: 'uuid' })
  productId: string;

  @ManyToOne(() => Product, (product) => product.orderItems, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'product_id',
    foreignKeyConstraintName: ORDER_ITEMS_PRODUCT_FK,
  })
  product: Product;

  @Column({
    name: 'product_name',
    type: 'varchar',
    length: PRODUCT_NAME_MAX_LENGTH,
  })
  productName: string;

  @Column({
    name: 'product_slug',
    type: 'varchar',
    length: PRODUCT_SLUG_MAX_LENGTH,
  })
  productSlug: string;

  @Column({
    name: 'unit_price',
    type: 'bigint',
    transformer: numericTransformer,
  })
  unitPrice: number;

  @Column({ type: 'integer' })
  quantity: number;

  @Column({
    name: 'line_total',
    type: 'bigint',
    transformer: numericTransformer,
  })
  lineTotal: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
