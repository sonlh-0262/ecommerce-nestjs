import {
  ApiProperty,
  ApiPropertyOptional,
  getSchemaPath,
} from '@nestjs/swagger';
import {
  HealthCheckResult,
  HealthCheckStatus,
  HealthIndicatorStatus,
} from '@nestjs/terminus';

export class HealthComponentDto {
  @ApiProperty({ enum: ['up', 'down'], example: 'up' })
  status: HealthIndicatorStatus;

  @ApiPropertyOptional({
    description:
      'Set only when the database ping timed out; other failures are logged, not exposed.',
    example: 'timeout of 1500ms exceeded',
  })
  message?: string;
}

export class HealthResponseDto {
  @ApiProperty({
    description: '`ok` when every component is up, `error` otherwise.',
    enum: ['ok', 'error'],
    example: 'ok',
  })
  status: HealthCheckStatus;

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

  @ApiProperty({
    description: 'Every component checked, keyed by name.',
    type: 'object',
    additionalProperties: { $ref: getSchemaPath(HealthComponentDto) },
    example: { database: { status: 'up' }, redis: { status: 'up' } },
  })
  details: Record<string, HealthComponentDto>;
}

export function toHealthResponse(
  result: HealthCheckResult,
  message: string,
): HealthResponseDto {
  return {
    status: result.status,
    message,
    uptime: Number(process.uptime().toFixed(2)),
    timestamp: new Date().toISOString(),
    details: result.details,
  };
}
