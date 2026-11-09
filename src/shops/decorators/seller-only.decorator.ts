import { applyDecorators, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';

import { SWAGGER_BEARER_AUTH_NAME } from '../../common/constants/swagger';
import { ApiErrorResponse } from '../../common/decorators/api-error-response.decorator';
import { ShopOwnerGuard } from '../guards/shop-owner.guard';

export const SellerOnly = () =>
  applyDecorators(
    UseGuards(ShopOwnerGuard),
    ApiBearerAuth(SWAGGER_BEARER_AUTH_NAME),
    ApiErrorResponse(
      HttpStatus.UNAUTHORIZED,
      'Missing, invalid or revoked token.',
    ),
    ApiErrorResponse(
      HttpStatus.FORBIDDEN,
      'The caller owns no ACTIVE shop, or has been locked.',
    ),
  );
