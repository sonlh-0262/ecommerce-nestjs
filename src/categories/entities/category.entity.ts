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

import { Product } from '../../products/entities/product.entity';
import {
  CATEGORIES_PARENT_FK,
  CATEGORIES_PARENT_INDEX,
  CATEGORIES_PARENT_NOT_SELF_CHECK,
  CATEGORIES_PARENT_NOT_SELF_EXPRESSION,
  NAME_MAX_LENGTH,
  SLUG_MAX_LENGTH,
  UNIQUE_CATEGORIES_SLUG_INDEX,
} from '../categories.constants';

@Entity('categories')
@Index(CATEGORIES_PARENT_INDEX, ['parentId'])
@Check(CATEGORIES_PARENT_NOT_SELF_CHECK, CATEGORIES_PARENT_NOT_SELF_EXPRESSION)
export class Category {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: NAME_MAX_LENGTH })
  name: string;

  @Index(UNIQUE_CATEGORIES_SLUG_INDEX, { unique: true })
  @Column({ type: 'varchar', length: SLUG_MAX_LENGTH })
  slug: string;

  @Column({ name: 'parent_id', type: 'uuid', nullable: true })
  parentId: string | null;

  @ManyToOne(() => Category, (category) => category.children, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'parent_id',
    foreignKeyConstraintName: CATEGORIES_PARENT_FK,
  })
  parent: Category | null;

  @OneToMany(() => Category, (category) => category.parent)
  children?: Category[];

  @OneToMany(() => Product, (product) => product.category)
  products?: Product[];

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
