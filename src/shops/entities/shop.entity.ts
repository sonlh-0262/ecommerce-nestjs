import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { User } from '../../users/entities/user.entity';
import {
  ADDRESS_MAX_LENGTH,
  PHONE_MAX_LENGTH,
} from '../../users/users.constants';
import { ShopStatus } from '../enums/shop-status.enum';
import {
  NAME_MAX_LENGTH,
  REASON_MAX_LENGTH,
  SHOPS_OWNER_FK,
  SHOPS_REJECTION_REASON_CHECK,
  SHOPS_REJECTION_REASON_EXPRESSION,
  SHOPS_REVIEWED_CHECK,
  SHOPS_REVIEWED_EXPRESSION,
  SHOPS_REVIEWER_FK,
  SHOPS_STATUS_INDEX,
  SLUG_MAX_LENGTH,
  UNIQUE_SHOPS_OWNER_INDEX,
  UNIQUE_SHOPS_SLUG_INDEX,
} from '../shops.constants';

@Entity('shops')
@Index(SHOPS_STATUS_INDEX, ['status', 'createdAt', 'id'])
@Check(SHOPS_REVIEWED_CHECK, SHOPS_REVIEWED_EXPRESSION)
@Check(SHOPS_REJECTION_REASON_CHECK, SHOPS_REJECTION_REASON_EXPRESSION)
export class Shop {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index(UNIQUE_SHOPS_OWNER_INDEX, { unique: true })
  @Column({ name: 'owner_id', type: 'uuid' })
  ownerId: string;

  @OneToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'owner_id', foreignKeyConstraintName: SHOPS_OWNER_FK })
  owner: User;

  @Column({ type: 'varchar', length: NAME_MAX_LENGTH })
  name: string;

  @Index(UNIQUE_SHOPS_SLUG_INDEX, { unique: true })
  @Column({ type: 'varchar', length: SLUG_MAX_LENGTH })
  slug: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: PHONE_MAX_LENGTH })
  phone: string;

  @Column({ type: 'varchar', length: ADDRESS_MAX_LENGTH })
  address: string;

  @Column({
    type: 'enum',
    enum: ShopStatus,
    enumName: 'shop_status',
    default: ShopStatus.Pending,
  })
  status: ShopStatus;

  @Column({
    name: 'rejection_reason',
    type: 'varchar',
    length: REASON_MAX_LENGTH,
    nullable: true,
  })
  rejectionReason: string | null;

  @Column({ name: 'reviewed_by', type: 'uuid', nullable: true })
  reviewedBy: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({
    name: 'reviewed_by',
    foreignKeyConstraintName: SHOPS_REVIEWER_FK,
  })
  reviewer: User | null;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
