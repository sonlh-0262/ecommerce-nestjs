import { ApiProperty } from '@nestjs/swagger';

export class LogoutResponseDto {
  @ApiProperty({
    description: 'Confirmation message, in the resolved language.',
    example: 'You have been logged out',
  })
  message: string;
}
