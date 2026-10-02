import { ApiProperty } from '@nestjs/swagger';

export class HealthResponseDto {
  @ApiProperty({ description: 'Service status.', example: 'ok' })
  status: string;

  @ApiProperty({
    description: 'Human readable status, in the resolved language.',
    example: 'Service is healthy',
  })
  message: string;

  @ApiProperty({ description: 'Process uptime in seconds.', example: 12.34 })
  uptime: number;

  @ApiProperty({
    description: 'Server time (ISO 8601).',
    example: '2026-01-01T00:00:00.000Z',
  })
  timestamp: string;
}
