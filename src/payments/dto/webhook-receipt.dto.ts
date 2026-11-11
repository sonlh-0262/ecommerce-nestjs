import { ApiProperty } from '@nestjs/swagger';

import { WebhookReceipt } from '../interfaces/webhook-receipt.interface';

export class WebhookReceiptDto {
  @ApiProperty({
    description: 'The event id at the provider.',
    example: 'evt_3PZ0aK2eZvKYlo2C1ZzQ0aBc',
  })
  id: string;

  @ApiProperty({
    description: 'true when the event had already been received and skipped.',
    example: false,
  })
  duplicate: boolean;
}

export class WebhookReceiptResponseDto {
  @ApiProperty({ type: WebhookReceiptDto })
  event: WebhookReceiptDto;
}

export function toWebhookReceiptResponse(
  receipt: WebhookReceipt,
): WebhookReceiptResponseDto {
  return { event: { id: receipt.id, duplicate: receipt.duplicate } };
}
