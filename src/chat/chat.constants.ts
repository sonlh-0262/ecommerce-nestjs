import { minutes } from '@nestjs/throttler';

import { trackByBearerToken } from '../common/throttling/bearer-token.tracker';
import { RouteRateLimit } from '../common/throttling/rate-limit.decorator';
import { trackBySocketUser } from '../common/throttling/socket-user.tracker';

export const MESSAGE_CONTENT_MIN_LENGTH = 1;
export const MESSAGE_CONTENT_MAX_LENGTH = 2000;

export const CONVERSATIONS_USER_FK = 'FK_conversations_user';
export const UNIQUE_CONVERSATIONS_USER_INDEX = 'UQ_conversations_user';
export const CONVERSATIONS_LAST_MESSAGE_INDEX =
  'IDX_conversations_last_message_at';

export const MESSAGES_CONVERSATION_FK = 'FK_messages_conversation';
export const MESSAGES_SENDER_FK = 'FK_messages_sender';
export const MESSAGES_LISTING_INDEX = 'IDX_messages_conversation_created_at';
export const MESSAGES_UNREAD_INDEX = 'IDX_messages_unread';
export const MESSAGES_UNREAD_CONDITION = 'read_at IS NULL';
export const MESSAGES_CONTENT_CHECK = 'CHK_messages_content';

export const MESSAGES_DEFAULT_LIMIT = 50;
export const MESSAGE_CLOCK_STEP_MS = 1;

export const NO_UNREAD = { fromOwner: 0, fromAdmins: 0 } as const;

export const CHAT_NAMESPACE = '/chat';
export const CHAT_CORS = { origin: '*' };

export const CHAT_EVENTS = {
  send: 'message:send',
  created: 'message:new',
} as const;

export const ADMINS_ROOM = 'admins';
export const USER_ROOM_PREFIX = 'user:';

export const CHAT_RATE_LIMITS = {
  send: { limit: 30, ttl: minutes(1), getTracker: trackByBearerToken },
  socketSend: { limit: 30, ttl: minutes(1), getTracker: trackBySocketUser },
} satisfies Record<string, RouteRateLimit>;
