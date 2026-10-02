import { Exclude } from 'class-transformer';
import {
  Check,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { UserRole } from '../enums/user-role.enum';
import { UserStatus } from '../enums/user-status.enum';
import {
  ADDRESS_MAX_LENGTH,
  EMAIL_MAX_LENGTH,
  FULL_NAME_MAX_LENGTH,
  PASSWORD_HASH_MAX_LENGTH,
  PHONE_MAX_LENGTH,
  USERNAME_MAX_LENGTH,
} from '../users.constants';
import {
  UNIQUE_USERS_USERNAME_INDEX,
  USERS_ALIVE_CONDITION,
  USERS_LISTING_INDEX,
  USERS_VERIFIED_STATUS_CHECK,
  USERS_VERIFIED_STATUS_EXPRESSION,
} from './user.entity.constants';

/**
 * `UQ_users_email` is deliberately absent from this class: the migration
 * creates it over `lower(email)`, and a functional index is a shape TypeORM's
 * decorators cannot describe. Every lookup by email goes through
 * `UsersService`, which compares the same expression.
 */
@Entity('users')
@Index(USERS_LISTING_INDEX, ['status', 'createdAt', 'id'], {
  where: USERS_ALIVE_CONDITION,
})
@Check(USERS_VERIFIED_STATUS_CHECK, USERS_VERIFIED_STATUS_EXPRESSION)
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: EMAIL_MAX_LENGTH })
  email: string;

  @Index(UNIQUE_USERS_USERNAME_INDEX, {
    unique: true,
    where: USERS_ALIVE_CONDITION,
  })
  @Column({ type: 'varchar', length: USERNAME_MAX_LENGTH })
  username: string;

  /**
   * `select: false` is what actually keeps the hash out of responses - it has
   * to be asked for by name, which only the login lookup does. `@Exclude()`
   * costs nothing and is there for the day a `ClassSerializerInterceptor` is
   * added, so the hash is already marked when it starts being consulted.
   */
  @Exclude()
  @Column({
    name: 'password_hash',
    type: 'varchar',
    length: PASSWORD_HASH_MAX_LENGTH,
    select: false,
  })
  passwordHash: string;

  /**
   * When the password was last changed. `JwtStrategy` rejects any token issued
   * before this moment, which revokes every live session in one write - the
   * `jti` denylist cannot do that because the ids of live tokens are unknown.
   */
  @Column({ name: 'password_changed_at', type: 'timestamptz', nullable: true })
  passwordChangedAt: Date | null;

  @Column({
    name: 'full_name',
    type: 'varchar',
    length: FULL_NAME_MAX_LENGTH,
    nullable: true,
  })
  fullName: string | null;

  @Column({ type: 'varchar', length: PHONE_MAX_LENGTH, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: ADDRESS_MAX_LENGTH, nullable: true })
  address: string | null;

  @Column({
    type: 'enum',
    enum: UserRole,
    enumName: 'user_role',
    default: UserRole.User,
  })
  role: UserRole;

  @Column({
    type: 'enum',
    enum: UserStatus,
    enumName: 'user_status',
    default: UserStatus.Pending,
  })
  status: UserStatus;

  /** A moment rather than a boolean, so support can see *when* it happened. */
  @Column({ name: 'email_verified_at', type: 'timestamptz', nullable: true })
  emailVerifiedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  /**
   * Soft delete. Not a lock - that is `status = INACTIVE`. A row with this set
   * is treated as though the account never existed, and TypeORM excludes it
   * from every repository read unless `withDeleted()` is asked for explicitly.
   */
  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt: Date | null;
}
