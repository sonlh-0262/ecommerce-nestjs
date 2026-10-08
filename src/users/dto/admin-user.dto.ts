import { ApiProperty } from '@nestjs/swagger';

import { User } from '../entities/user.entity';
import { UserOrderStats } from '../interfaces/user-order-stats.interface';
import { toUserDto, UserDto } from './user.dto';

export class AdminUserDto extends UserDto {
  @ApiProperty({ description: 'Orders the account has placed.', example: 3 })
  ordersCount: number;

  @ApiProperty({
    description: 'Total of the delivered orders, in VND.',
    example: 1500000,
  })
  totalSpent: number;

  @ApiProperty({
    nullable: true,
    description: 'When the latest order was placed (ISO 8601).',
    example: '2026-10-01T08:30:00.000Z',
  })
  lastOrderAt: string | null;
}

export class AdminUserResponseDto {
  @ApiProperty({ type: AdminUserDto })
  user: AdminUserDto;
}

export class UsersResponseDto {
  @ApiProperty({ type: [UserDto] })
  users: UserDto[];

  @ApiProperty({
    description: 'Accounts matching the filters, across every page.',
    example: 42,
  })
  usersCount: number;
}

export function toAdminUserResponse(
  user: User,
  avatarUrl: string | null,
  stats: UserOrderStats,
): AdminUserResponseDto {
  return {
    user: {
      ...toUserDto(user, avatarUrl),
      ordersCount: stats.ordersCount,
      totalSpent: stats.totalSpent,
      lastOrderAt: stats.lastOrderAt?.toISOString() ?? null,
    },
  };
}
