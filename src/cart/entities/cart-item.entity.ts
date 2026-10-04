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

import { Product } from '../../products/entities/product.entity';
import {
  CART_ITEMS_CART_FK,
  CART_ITEMS_PRODUCT_FK,
  CART_ITEMS_QUANTITY_CHECK,
  CART_ITEMS_QUANTITY_EXPRESSION,
  UNIQUE_CART_ITEMS_CART_PRODUCT_INDEX,
} from '../cart.constants';
import { Cart } from './cart.entity';

@Entity('cart_items')
@Index(UNIQUE_CART_ITEMS_CART_PRODUCT_INDEX, ['cartId', 'productId'], {
  unique: true,
})
@Check(CART_ITEMS_QUANTITY_CHECK, CART_ITEMS_QUANTITY_EXPRESSION)
export class CartItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'cart_id', type: 'uuid' })
  cartId: string;

  @ManyToOne(() => Cart, (cart) => cart.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'cart_id', foreignKeyConstraintName: CART_ITEMS_CART_FK })
  cart: Cart;

  @Column({ name: 'product_id', type: 'uuid' })
  productId: string;

  @ManyToOne(() => Product, (product) => product.cartItems, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'product_id',
    foreignKeyConstraintName: CART_ITEMS_PRODUCT_FK,
  })
  product: Product;

  @Column({ type: 'integer' })
  quantity: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
