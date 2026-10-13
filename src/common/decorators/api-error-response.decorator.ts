import { HttpStatus, Type } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';

import { ErrorResponseDto } from '../dto/error-response.dto';

export const ApiErrorResponse = (
  status: HttpStatus,
  description: string,
  type: Type<unknown> = ErrorResponseDto,
) => ApiResponse({ status, description, type });
