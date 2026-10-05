import { HttpStatus } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';

import { ErrorResponseDto } from '../dto/error-response.dto';

export const ApiErrorResponse = (status: HttpStatus, description: string) =>
  ApiResponse({ status, description, type: ErrorResponseDto });
