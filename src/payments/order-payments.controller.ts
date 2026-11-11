import {
  Controller,
  Get,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';

import { SWAGGER_BEARER_AUTH_NAME } from '../common/constants/swagger';
import { ApiErrorResponse } from '../common/decorators/api-error-response.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { RateLimit } from '../common/throttling/rate-limit.decorator';
import { User } from '../users/entities/user.entity';
import {
  PaymentResponseDto,
  PaymentsResponseDto,
  toPaymentResponse,
  toPaymentsResponse,
} from './dto/payment.dto';
import { PAYMENTS_RATE_LIMITS } from './payments.constants';
import { PaymentsService } from './payments.service';

@ApiTags('Payments')
@ApiBearerAuth(SWAGGER_BEARER_AUTH_NAME)
@ApiParam({ name: 'code', example: 'ORD-20261110-0001' })
@ApiErrorResponse(HttpStatus.UNAUTHORIZED, 'Missing, invalid or revoked token.')
@ApiErrorResponse(HttpStatus.FORBIDDEN, 'The account has been locked.')
@ApiErrorResponse(HttpStatus.NOT_FOUND, 'I have no order with this code.')
@Controller('orders/:code/payments')
export class OrderPaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post()
  @RateLimit(PAYMENTS_RATE_LIMITS.start)
  @ApiOperation({
    summary: 'Start paying one of my card orders',
    description:
      'Opens a payment intent at the configured provider for the order ' +
      'total and returns its `clientSecret`, which Stripe.js (or the ' +
      'simulator) uses to confirm the card. While an attempt is still ' +
      'open the same one is returned, so retrying never charges twice. ' +
      'The order becomes PAID when the provider reports the success by ' +
      'webhook.',
  })
  @ApiCreatedResponse({ type: PaymentResponseDto })
  @ApiErrorResponse(HttpStatus.CONFLICT, 'The order is already paid.')
  @ApiErrorResponse(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'The order is not paid by card, or is no longer pending or confirmed.',
  )
  @ApiErrorResponse(
    HttpStatus.TOO_MANY_REQUESTS,
    'Too many payment attempts in a short time.',
  )
  @ApiErrorResponse(
    HttpStatus.BAD_GATEWAY,
    'The payment provider could not open an intent.',
  )
  async start(
    @CurrentUser() user: User,
    @Param('code') code: string,
  ): Promise<PaymentResponseDto> {
    return toPaymentResponse(await this.payments.start(user, code));
  }

  @Get()
  @ApiOperation({
    summary: 'List the payment attempts of one of my orders',
    description: 'Newest first, failed and refunded attempts included.',
  })
  @ApiOkResponse({ type: PaymentsResponseDto })
  @ApiErrorResponse(HttpStatus.BAD_REQUEST, 'A query parameter is invalid.')
  async list(
    @CurrentUser() user: User,
    @Param('code') code: string,
    @Query() query: PaginationQueryDto,
  ): Promise<PaymentsResponseDto> {
    return toPaymentsResponse(await this.payments.list(user, code, query));
  }
}
