import { ApiProperty } from '@nestjs/swagger';

import { User } from '../../users/entities/user.entity';
import { toUserDto, UserDto } from '../../users/dto/user.dto';
import { AuthSession } from '../interfaces/auth-session.interface';

/** The account as login returns it: the public user plus its new session. */
export class AuthenticatedUserDto extends UserDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  token: string;

  @ApiProperty({
    description: 'Seconds until the token expires.',
    example: 86400,
  })
  expiresIn: number;
}

export class AuthenticatedUserResponseDto {
  @ApiProperty({ type: AuthenticatedUserDto })
  user: AuthenticatedUserDto;
}

export function toAuthenticatedUserResponse(
  user: User,
  session: AuthSession,
): AuthenticatedUserResponseDto {
  return { user: { ...toUserDto(user), ...session } };
}
