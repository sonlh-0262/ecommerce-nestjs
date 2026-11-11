import { minutes } from '@nestjs/throttler';
import { JobsOptions } from 'bullmq';

import { MILLISECONDS_PER_MINUTE } from '../common/constants/time';
import { trackByBearerToken } from '../common/throttling/bearer-token.tracker';
import { RouteRateLimit } from '../common/throttling/rate-limit.decorator';
import { OrderStatus } from '../orders/enums/order-status.enum';
import { PaymentAttemptStatus } from './enums/payment-attempt-status.enum';

export const PAYMENT_CURRENCY = 'VND';
export const CURRENCY_LENGTH = 3;
export const PROVIDER_ID_MAX_LENGTH = 255;
export const CLIENT_SECRET_MAX_LENGTH = 255;
export const CARD_BRAND_MAX_LENGTH = 20;
export const CARD_LAST4_LENGTH = 4;
export const FAILURE_CODE_MAX_LENGTH = 50;
export const FAILURE_MESSAGE_MAX_LENGTH = 255;
export const EVENT_TYPE_MAX_LENGTH = 100;

export const PAYMENTS_ORDER_FK = 'FK_payments_order';
export const UNIQUE_PAYMENTS_PROVIDER_ID_INDEX =
  'UQ_payments_provider_payment_id';
export const UNIQUE_PAYMENTS_OPEN_PER_ORDER_INDEX =
  'UQ_payments_open_per_order';
export const PAYMENTS_ORDER_LISTING_INDEX = 'IDX_payments_order_created_at';
export const PAYMENTS_AMOUNT_CHECK = 'CHK_payments_amount';
export const PAYMENTS_SUCCEEDED_AT_CHECK = 'CHK_payments_succeeded_at';
export const PAYMENTS_REFUNDED_AT_CHECK = 'CHK_payments_refunded_at';

export const PAYMENTS_OPEN_CONDITION =
  "status IN ('PENDING', 'REQUIRES_ACTION')";
export const PAYMENTS_SUCCEEDED_AT_EXPRESSION =
  "(status IN ('SUCCEEDED', 'REFUND_PENDING', 'REFUNDED')) = (succeeded_at IS NOT NULL)";
export const PAYMENTS_REFUNDED_AT_EXPRESSION =
  "(status = 'REFUNDED') = (refunded_at IS NOT NULL)";

export const PAYMENT_EVENTS_PAYMENT_FK = 'FK_payment_events_payment';
export const UNIQUE_PAYMENT_EVENTS_PROVIDER_EVENT_INDEX =
  'UQ_payment_events_provider_event_id';
export const PAYMENT_EVENTS_PAYMENT_INDEX = 'IDX_payment_events_payment_id';

export const OPEN_PAYMENT_STATUSES: readonly PaymentAttemptStatus[] = [
  PaymentAttemptStatus.Pending,
  PaymentAttemptStatus.RequiresAction,
];

export const STRIPE_SIGNATURE_HEADER = 'stripe-signature';
export const MOCK_SIGNATURE_HEADER = 'mock-signature';

export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');

export const PAYMENT_GATEWAY_TIMEOUT_MS = 10_000;
export const PAYMENT_GATEWAY_MAX_RETRIES = 1;

export const WEBHOOK_TOLERANCE_SECONDS = 300;

export const GATEWAY_EVENT_STATUSES: Readonly<
  Record<string, PaymentAttemptStatus>
> = {
  'payment_intent.succeeded': PaymentAttemptStatus.Succeeded,
  'payment_intent.payment_failed': PaymentAttemptStatus.Failed,
  'payment_intent.requires_action': PaymentAttemptStatus.RequiresAction,
  'payment_intent.canceled': PaymentAttemptStatus.Failed,
};

export const PAYMENTS_QUEUE = 'payments';

export const PAYMENT_JOB = {
  Refund: 'refund-payment',
} as const;

export const PAYMENT_JOB_OPTIONS: JobsOptions = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 10_000 },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 1000 },
};

export const PAYMENT_ENQUEUE_TIMEOUT_MS = 3000;

export const REFUND_KEY_PREFIX = 'refund-';

export const REFUND_RETRY_AFTER_MS = 10 * MILLISECONDS_PER_MINUTE;
export const REFUND_RETRY_BATCH_SIZE = 100;
export const SETTLED_JOB_STATES: readonly string[] = ['completed', 'failed'];

export const PAYMENT_INTENT_OBJECT = 'payment_intent';

export const CHARGED_PAYMENT_STATUSES: readonly PaymentAttemptStatus[] = [
  PaymentAttemptStatus.Succeeded,
  PaymentAttemptStatus.RefundPending,
];

export const PAYMENTS_RATE_LIMITS = {
  start: { limit: 10, ttl: minutes(1), getTracker: trackByBearerToken },
  simulate: { limit: 20, ttl: minutes(1) },
} satisfies Record<string, RouteRateLimit>;

export const REFUNDED_ORDER_STATUSES: readonly OrderStatus[] = [
  OrderStatus.Cancelled,
  OrderStatus.Rejected,
];
