import { ApiProperty } from '@nestjs/swagger';

import { User } from '../entities/user.entity';

export type UserRef = Pick<User, 'id' | 'email' | 'username' | 'fullName'>;

export class UserRefDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'son@example.com', format: 'email' })
  email: string;

  @ApiProperty({ example: 'sonlh' })
  username: string;

  @ApiProperty({ nullable: true, example: 'Lanh Hung Son' })
  fullName: string | null;
}

export function toUserRef(user: UserRef): UserRefDto {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    fullName: user.fullName,
  };
}
