import { User } from '../../users/entities/user.entity';
import { Conversation } from '../entities/conversation.entity';
import { Message } from '../entities/message.entity';

export type ConversationOwner = Pick<
  User,
  'id' | 'email' | 'username' | 'fullName'
>;

export interface ConversationView {
  conversation: Conversation;
  owner: ConversationOwner;
  lastMessage: Message | null;
  unreadCount: number;
}

export interface ConversationPage {
  conversations: ConversationView[];
  total: number;
}

export interface UnreadCounts {
  fromOwner: number;
  fromAdmins: number;
}

export interface UnreadRow {
  conversationId: string;
  fromOwner: boolean;
  count: number;
}
