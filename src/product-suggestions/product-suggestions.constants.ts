import { hours } from '@nestjs/throttler';

import { trackByBearerToken } from '../common/throttling/bearer-token.tracker';
import { RouteRateLimit } from '../common/throttling/rate-limit.decorator';
import { SuggestionStatus } from './enums/suggestion-status.enum';

export const NAME_MAX_LENGTH = 255;
export const REFERENCE_URL_MAX_LENGTH = 500;
export const ADMIN_NOTE_MAX_LENGTH = 500;

export const PRODUCT_SUGGESTIONS_USER_FK = 'FK_product_suggestions_user';
export const PRODUCT_SUGGESTIONS_REVIEWER_FK =
  'FK_product_suggestions_reviewer';
export const PRODUCT_SUGGESTIONS_USER_INDEX =
  'IDX_product_suggestions_user_created_at';
export const PRODUCT_SUGGESTIONS_STATUS_INDEX =
  'IDX_product_suggestions_status_created_at';
export const PRODUCT_SUGGESTIONS_REVIEWED_CHECK =
  'CHK_product_suggestions_reviewed';

export const NAME_MIN_LENGTH = 1;
export const DESCRIPTION_MIN_LENGTH = 10;
export const DESCRIPTION_MAX_LENGTH = 2000;
export const ADMIN_NOTE_MIN_LENGTH = 1;
export const REFERENCE_URL_PROTOCOLS = ['http', 'https'];

export const MAX_PENDING_SUGGESTIONS = 5;

export const SUGGESTION_DECISIONS = [
  SuggestionStatus.Approved,
  SuggestionStatus.Rejected,
] as const;

export type SuggestionDecision = (typeof SUGGESTION_DECISIONS)[number];

export const SUGGESTIONS_RATE_LIMITS = {
  create: { limit: 10, ttl: hours(1), getTracker: trackByBearerToken },
} satisfies Record<string, RouteRateLimit>;
