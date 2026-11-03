import { Conversation } from '../entities/conversation.entity';
import { Message } from '../entities/message.entity';
import {
  toChatMessageResponse,
  toChatMessagesResponse,
} from './chat-message.dto';
import { toConversationsResponse } from './conversation.dto';

describe('chat mappers', () => {
  const SENT_AT = new Date('2026-10-29T08:30:00.000Z');
  const READ_AT = new Date('2026-10-29T08:31:00.000Z');
  const OWNER = {
    id: 'u1',
    email: 'son@example.com',
    username: 'sonlh',
    fullName: 'Lanh Hung Son',
  };

  const message = {
    id: 'm1',
    conversationId: 'c1',
    senderId: 'u1',
    content: 'Xin chào',
    readAt: READ_AT,
    createdAt: SENT_AT,
    updatedAt: READ_AT,
  } as Message;

  const MESSAGE_DTO = {
    id: 'm1',
    conversationId: 'c1',
    senderId: 'u1',
    content: 'Xin chào',
    readAt: READ_AT.toISOString(),
    createdAt: SENT_AT.toISOString(),
  };

  it('wraps one message', () => {
    expect(toChatMessageResponse(message)).toEqual({ message: MESSAGE_DTO });
  });

  it('reports an unread message as such', () => {
    expect(
      toChatMessageResponse({ ...message, readAt: null }).message.readAt,
    ).toBeNull();
  });

  it('wraps a page of messages without a count', () => {
    expect(toChatMessagesResponse([message])).toEqual({
      messages: [MESSAGE_DTO],
    });
  });

  it('wraps a page of conversations with its owner, last message and count', () => {
    const conversation = {
      id: 'c1',
      userId: 'u1',
      lastMessageAt: SENT_AT,
      createdAt: SENT_AT,
    } as Conversation;

    expect(
      toConversationsResponse({
        conversations: [
          { conversation, owner: OWNER, lastMessage: message, unreadCount: 2 },
        ],
        total: 1,
      }),
    ).toEqual({
      conversations: [
        {
          id: 'c1',
          user: OWNER,
          lastMessageAt: SENT_AT.toISOString(),
          lastMessage: MESSAGE_DTO,
          unreadCount: 2,
          createdAt: SENT_AT.toISOString(),
        },
      ],
      conversationsCount: 1,
    });
  });

  it('maps a conversation that has no message yet', () => {
    const [dto] = toConversationsResponse({
      conversations: [
        {
          conversation: {
            id: 'c1',
            userId: 'u1',
            lastMessageAt: null,
            createdAt: SENT_AT,
          } as Conversation,
          owner: OWNER,
          lastMessage: null,
          unreadCount: 0,
        },
      ],
      total: 1,
    }).conversations;

    expect(dto).toMatchObject({ lastMessageAt: null, lastMessage: null });
  });
});
