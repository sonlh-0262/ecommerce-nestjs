import { ApiProperty } from '@nestjs/swagger';

import { User } from '../entities/user.entity';
import { UserRole } from '../enums/user-role.enum';
import { UserStatus } from '../enums/user-status.enum';

/**
 * The public shape of an account. Never the entity itself: `passwordHash` and
 * `deletedAt` must not reach a client, and omitting them by construction is
 * safer than relying on a serializer to strip them.
 */
export class UserDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'son@example.com', format: 'email' })
  email: string;

  @ApiProperty({ example: 'sonlh' })
  username: string;

  @ApiProperty({ nullable: true, example: 'Lanh Hung Son' })
  fullName: string | null;

  @ApiProperty({ nullable: true, example: '0901234567' })
  phone: string | null;

  @ApiProperty({ nullable: true, example: '1 Nguyen Trai, Ha Noi' })
  address: string | null;

  @ApiProperty({
    nullable: true,
    description: 'URL of the avatar, or null when the account has none.',
    example: null,
  })
  avatarUrl: string | null;

  @ApiProperty({ enum: UserRole, enumName: 'UserRole' })
  role: UserRole;

  @ApiProperty({ enum: UserStatus, enumName: 'UserStatus' })
  status: UserStatus;

  @ApiProperty({
    nullable: true,
    description: 'When the email was confirmed (ISO 8601), null until then.',
    example: '2026-09-20T02:10:00.000Z',
  })
  emailVerifiedAt: string | null;

  @ApiProperty({ example: '2026-09-20T02:00:00.000Z' })
  createdAt: string;
}

export function toUserDto(user: User): UserDto {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    fullName: user.fullName,
    phone: user.phone,
    address: user.address,
    // Avatars are rows in the polymorphic `attachments` table, which arrives
    // with the product and profile modules. Until then no account has one.
    avatarUrl: null,
    role: user.role,
    status: user.status,
    emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
  };
}

export class UserResponseDto {
  @ApiProperty({ type: UserDto })
  user: UserDto;
}

export function toUserResponse(user: User): UserResponseDto {
  return { user: toUserDto(user) };
}
