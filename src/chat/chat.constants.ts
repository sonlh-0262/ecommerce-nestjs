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
