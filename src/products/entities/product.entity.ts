import {
  Check,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { CartItem } from '../../cart/entities/cart-item.entity';
import { Category } from '../../categories/entities/category.entity';
import { numericTransformer } from '../../common/transformers/numeric.transformer';
import { OrderItem } from '../../orders/entities/order-item.entity';
import { Review } from '../../reviews/entities/review.entity';
import { ProductStatus } from '../enums/product-status.enum';
import {
  NAME_MAX_LENGTH,
  PRODUCTS_ADMIN_LIST_INDEX,
  PRODUCTS_ARCHIVED_CHECK,
  PRODUCTS_CATEGORY_FK,
  PRODUCTS_PRICE_CHECK,
  PRODUCTS_PUBLIC_LIST_INDEX,
  PRODUCTS_PUBLISHED_CONDITION,
  PRODUCTS_RATING_CHECK,
  PRODUCTS_RATING_INDEX,
  PRODUCTS_REVIEW_COUNT_CHECK,
  PRODUCTS_SALE_PRICE_CHECK,
  PRODUCTS_SEARCH_VECTOR_EXPRESSION,
  PRODUCTS_SOLD_COUNT_CHECK,
  PRODUCTS_SOLD_COUNT_INDEX,
  PRODUCTS_STOCK_CHECK,
  PRODUCTS_ALIVE_CONDITION,
  PRODUCTS_FEATURED_CONDITION,
  PRODUCTS_FEATURED_INDEX,
  UNIQUE_PRODUCTS_SLUG_INDEX,
  RATING_PRECISION,
  RATING_SCALE,
  SLUG_MAX_LENGTH,
} from '../products.constants';
import { ProductImage } from './product-image.entity';

@Entity('products')
@Index(PRODUCTS_PUBLIC_LIST_INDEX, ['categoryId', 'createdAt', 'id'], {
  where: PRODUCTS_PUBLISHED_CONDITION,
})
@Index(PRODUCTS_SOLD_COUNT_INDEX, ['soldCount', 'id'], {
  where: PRODUCTS_PUBLISHED_CONDITION,
})
@Index(PRODUCTS_RATING_INDEX, ['averageRating', 'id'], {
  where: PRODUCTS_PUBLISHED_CONDITION,
})
@Index(PRODUCTS_ADMIN_LIST_INDEX, ['status', 'createdAt', 'id'])
@Index(PRODUCTS_FEATURED_INDEX, ['createdAt', 'id'], {
  where: PRODUCTS_FEATURED_CONDITION,
})
@Check(PRODUCTS_PRICE_CHECK, 'price >= 0')
@Check(
  PRODUCTS_SALE_PRICE_CHECK,
  'sale_price IS NULL OR (sale_price >= 0 AND sale_price < price)',
)
@Check(PRODUCTS_STOCK_CHECK, 'stock >= 0')
@Check(PRODUCTS_SOLD_COUNT_CHECK, 'sold_count >= 0')
@Check(PRODUCTS_RATING_CHECK, 'average_rating >= 0 AND average_rating <= 5')
@Check(PRODUCTS_REVIEW_COUNT_CHECK, 'review_count >= 0')
@Check(PRODUCTS_ARCHIVED_CHECK, "deleted_at IS NULL OR status = 'ARCHIVED'")
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'category_id', type: 'uuid' })
  categoryId: string;

  @ManyToOne(() => Category, (category) => category.products, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'category_id',
    foreignKeyConstraintName: PRODUCTS_CATEGORY_FK,
  })
  category: Category;

  @Column({ type: 'varchar', length: NAME_MAX_LENGTH })
  name: string;

  @Index(UNIQUE_PRODUCTS_SLUG_INDEX, {
    unique: true,
    where: PRODUCTS_ALIVE_CONDITION,
  })
  @Column({ type: 'varchar', length: SLUG_MAX_LENGTH })
  slug: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'bigint', transformer: numericTransformer })
  price: number;

  @Column({
    name: 'sale_price',
    type: 'bigint',
    nullable: true,
    transformer: numericTransformer,
  })
  salePrice: number | null;

  @Column({ type: 'integer', default: 0 })
  stock: number;

  @Column({
    type: 'enum',
    enum: ProductStatus,
    enumName: 'product_status',
    default: ProductStatus.Draft,
  })
  status: ProductStatus;

  @Column({ name: 'is_featured', type: 'boolean', default: false })
  isFeatured: boolean;

  @Column({ name: 'sold_count', type: 'integer', default: 0 })
  soldCount: number;

  @Column({
    name: 'average_rating',
    type: 'numeric',
    precision: RATING_PRECISION,
    scale: RATING_SCALE,
    default: 0,
    transformer: numericTransformer,
  })
  averageRating: number;

  @Column({ name: 'review_count', type: 'integer', default: 0 })
  reviewCount: number;

  @Column({
    name: 'search_vector',
    type: 'tsvector',
    generatedType: 'STORED',
    asExpression: PRODUCTS_SEARCH_VECTOR_EXPRESSION,
    select: false,
    insert: false,
    update: false,
    nullable: true,
  })
  searchVector?: string;

  @OneToMany(() => ProductImage, (image) => image.product)
  images?: ProductImage[];

  @OneToMany(() => CartItem, (item) => item.product)
  cartItems?: CartItem[];

  @OneToMany(() => OrderItem, (item) => item.product)
  orderItems?: OrderItem[];

  @OneToMany(() => Review, (review) => review.product)
  reviews?: Review[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt: Date | null;
}
