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

import { UserTokenType } from '../enums/user-token-type.enum';
import { TOKEN_HASH_LENGTH } from '../users.constants';
import {
  UNIQUE_USER_TOKENS_HASH_INDEX,
  USER_TOKENS_EXPIRY_CHECK,
  USER_TOKENS_EXPIRY_EXPRESSION,
  USER_TOKENS_LOOKUP_INDEX,
  USER_TOKENS_UNUSED_CONDITION,
  USER_TOKENS_USER_FK,
} from './user.entity.constants';
import { User } from './user.entity';

@Entity('user_tokens')
@Index(USER_TOKENS_LOOKUP_INDEX, ['userId', 'type'], {
  where: USER_TOKENS_UNUSED_CONDITION,
})
@Check(USER_TOKENS_EXPIRY_CHECK, USER_TOKENS_EXPIRY_EXPRESSION)
export class UserToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, (user) => user.tokens, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: USER_TOKENS_USER_FK,
  })
  user: User;

  @Column({
    type: 'enum',
    enum: UserTokenType,
    enumName: 'user_token_type',
  })
  type: UserTokenType;

  @Index(UNIQUE_USER_TOKENS_HASH_INDEX, { unique: true })
  @Column({ name: 'token_hash', type: 'char', length: TOKEN_HASH_LENGTH })
  tokenHash: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ name: 'used_at', type: 'timestamptz', nullable: true })
  usedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
