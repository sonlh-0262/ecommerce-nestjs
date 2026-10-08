import { ApiProperty } from '@nestjs/swagger';

export class ErrorBodyDto {
  @ApiProperty({
    type: [String],
    description: 'Human readable reasons, in the resolved language.',
    example: ['This record already exists'],
  })
  body: string[];
}

export class ErrorResponseDto {
  @ApiProperty({ type: ErrorBodyDto })
  errors: ErrorBodyDto;
}

export function toErrorResponse(messages: string[]): ErrorResponseDto {
  return { errors: { body: messages } };
}
