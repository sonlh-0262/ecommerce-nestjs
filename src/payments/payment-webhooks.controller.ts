import {
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import {
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { ApiErrorResponse } from '../common/decorators/api-error-response.decorator';
import { Public } from '../common/decorators/public.decorator';
import { RawBody } from '../common/decorators/raw-body.decorator';
import {
  toWebhookReceiptResponse,
  WebhookReceiptResponseDto,
} from './dto/webhook-receipt.dto';
import { PaymentProvider } from './enums/payment-provider.enum';
import { PaymentWebhooksService } from './payment-webhooks.service';
import {
  MOCK_SIGNATURE_HEADER,
  STRIPE_SIGNATURE_HEADER,
} from './payments.constants';

@ApiTags('Payments')
@Public()
@ApiOkResponse({ type: WebhookReceiptResponseDto })
@ApiErrorResponse(
  HttpStatus.BAD_REQUEST,
  'The signature is missing, does not match or is too old.',
)
@ApiErrorResponse(
  HttpStatus.NOT_FOUND,
  'This provider is not the one the API is configured with.',
)
@Controller('payments/webhooks')
export class PaymentWebhooksController {
  constructor(private readonly webhooks: PaymentWebhooksService) {}

  @Post('stripe')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Receive a Stripe event',
    description:
      'Called by Stripe, not by clients. The signature is checked against ' +
      'the raw body; an event received twice is acknowledged and skipped.',
  })
  @ApiHeader({ name: STRIPE_SIGNATURE_HEADER, required: true })
  async stripe(
    @RawBody() rawBody: Buffer | undefined,
    @Headers(STRIPE_SIGNATURE_HEADER) signature: string | undefined,
  ): Promise<WebhookReceiptResponseDto> {
    return toWebhookReceiptResponse(
      await this.webhooks.receive(PaymentProvider.Stripe, rawBody, signature),
    );
  }

  @Post('mock')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Receive a simulator event',
    description:
      'The simulator delivers its events here, signed `t=<seconds>,v1=<hex ' +
      'HMAC-SHA256 of "<t>.<body>">` with MOCK_PAYMENT_WEBHOOK_SECRET.',
  })
  @ApiHeader({ name: MOCK_SIGNATURE_HEADER, required: true })
  async mock(
    @RawBody() rawBody: Buffer | undefined,
    @Headers(MOCK_SIGNATURE_HEADER) signature: string | undefined,
  ): Promise<WebhookReceiptResponseDto> {
    return toWebhookReceiptResponse(
      await this.webhooks.receive(PaymentProvider.Mock, rawBody, signature),
    );
  }
}
