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

import { Order } from '../../orders/entities/order.entity';
import { Product } from '../../products/entities/product.entity';
import { User } from '../../users/entities/user.entity';
import {
  CONTENT_MAX_LENGTH,
  REVIEWS_CONTENT_CHECK,
  REVIEWS_LISTING_INDEX,
  REVIEWS_ORDER_FK,
  REVIEWS_PRODUCT_FK,
  REVIEWS_RATING_CHECK,
  REVIEWS_RATING_INDEX,
  REVIEWS_USER_FK,
  UNIQUE_REVIEWS_PRODUCT_USER_INDEX,
} from '../reviews.constants';

@Entity('reviews')
@Index(UNIQUE_REVIEWS_PRODUCT_USER_INDEX, ['productId', 'userId'], {
  unique: true,
})
@Index(REVIEWS_LISTING_INDEX, ['productId', 'createdAt', 'id'])
@Index(REVIEWS_RATING_INDEX, ['productId', 'rating'])
@Check(REVIEWS_RATING_CHECK, 'rating BETWEEN 1 AND 5')
@Check(REVIEWS_CONTENT_CHECK, 'char_length(content) BETWEEN 10 AND 1000')
export class Review {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'product_id', type: 'uuid' })
  productId: string;

  @ManyToOne(() => Product, (product) => product.reviews, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'product_id',
    foreignKeyConstraintName: REVIEWS_PRODUCT_FK,
  })
  product: Product;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, (user) => user.reviews, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: REVIEWS_USER_FK })
  user: User;

  @Column({ name: 'order_id', type: 'uuid', nullable: true })
  orderId: string | null;

  @ManyToOne(() => Order, (order) => order.reviews, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'order_id', foreignKeyConstraintName: REVIEWS_ORDER_FK })
  order: Order | null;

  @Column({ type: 'smallint' })
  rating: number;

  @Column({ type: 'varchar', length: CONTENT_MAX_LENGTH })
  content: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
