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
import { SuggestionStatus } from '../enums/suggestion-status.enum';
import {
  ADMIN_NOTE_MAX_LENGTH,
  NAME_MAX_LENGTH,
  PRODUCT_SUGGESTIONS_REVIEWED_CHECK,
  PRODUCT_SUGGESTIONS_REVIEWER_FK,
  PRODUCT_SUGGESTIONS_STATUS_INDEX,
  PRODUCT_SUGGESTIONS_USER_FK,
  PRODUCT_SUGGESTIONS_USER_INDEX,
  REFERENCE_URL_MAX_LENGTH,
} from '../product-suggestions.constants';

@Entity('product_suggestions')
@Index(PRODUCT_SUGGESTIONS_USER_INDEX, ['userId', 'createdAt', 'id'])
@Index(PRODUCT_SUGGESTIONS_STATUS_INDEX, ['status', 'createdAt', 'id'])
@Check(
  PRODUCT_SUGGESTIONS_REVIEWED_CHECK,
  "(status = 'PENDING') = (reviewed_at IS NULL)",
)
export class ProductSuggestion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, (user) => user.productSuggestions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: PRODUCT_SUGGESTIONS_USER_FK,
  })
  user: User;

  @Column({ type: 'varchar', length: NAME_MAX_LENGTH })
  name: string;

  @Column({ type: 'text' })
  description: string;

  @Column({
    name: 'reference_url',
    type: 'varchar',
    length: REFERENCE_URL_MAX_LENGTH,
    nullable: true,
  })
  referenceUrl: string | null;

  @Column({
    type: 'enum',
    enum: SuggestionStatus,
    enumName: 'suggestion_status',
    default: SuggestionStatus.Pending,
  })
  status: SuggestionStatus;

  @Column({
    name: 'admin_note',
    type: 'varchar',
    length: ADMIN_NOTE_MAX_LENGTH,
    nullable: true,
  })
  adminNote: string | null;

  @Column({ name: 'reviewed_by', type: 'uuid', nullable: true })
  reviewedBy: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({
    name: 'reviewed_by',
    foreignKeyConstraintName: PRODUCT_SUGGESTIONS_REVIEWER_FK,
  })
  reviewer: User | null;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
