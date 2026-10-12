import { ApiProperty } from '@nestjs/swagger';

export type ErrorDetails = Record<string, unknown>;

export interface DetailedErrorBody {
  message: string;
  details: ErrorDetails;
}

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

export function withDetails(
  message: string,
  details: ErrorDetails,
): DetailedErrorBody {
  return { message, details };
}

export function toErrorResponse(
  messages: string[],
  details: ErrorDetails = {},
): ErrorResponseDto {
  return { errors: { ...details, body: messages } };
}
