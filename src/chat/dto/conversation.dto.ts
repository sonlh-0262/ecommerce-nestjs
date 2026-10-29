import { ApiProperty } from '@nestjs/swagger';

import { paginated } from '../../common/helpers/paginated';
import {
  ConversationOwner,
  ConversationPage,
  ConversationView,
} from '../interfaces/conversation-view.interface';
import { ChatMessageDto, toChatMessageDto } from './chat-message.dto';

export class ConversationOwnerDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'son@example.com', format: 'email' })
  email: string;

  @ApiProperty({ example: 'sonlh' })
  username: string;

  @ApiProperty({ nullable: true, example: 'Lanh Hung Son' })
  fullName: string | null;
}

export class ConversationDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({
    type: ConversationOwnerDto,
    description: 'The customer the conversation belongs to.',
  })
  user: ConversationOwnerDto;

  @ApiProperty({
    nullable: true,
    description: 'When the latest message was sent (ISO 8601).',
    example: '2026-10-29T08:30:00.000Z',
  })
  lastMessageAt: string | null;

  @ApiProperty({ type: ChatMessageDto, nullable: true })
  lastMessage: ChatMessageDto | null;

  @ApiProperty({
    description: 'Messages from the other side the caller has not read yet.',
    example: 2,
  })
  unreadCount: number;

  @ApiProperty({ example: '2026-10-29T08:00:00.000Z' })
  createdAt: string;
}

export class ConversationsResponseDto {
  @ApiProperty({
    type: [ConversationDto],
    description: 'Most recent activity first.',
  })
  conversations: ConversationDto[];

  @ApiProperty({
    description: 'Conversations the caller can see, across every page.',
    example: 1,
  })
  conversationsCount: number;
}

function toOwnerDto(owner: ConversationOwner): ConversationOwnerDto {
  return {
    id: owner.id,
    email: owner.email,
    username: owner.username,
    fullName: owner.fullName,
  };
}

function toConversationDto({
  conversation,
  owner,
  lastMessage,
  unreadCount,
}: ConversationView): ConversationDto {
  return {
    id: conversation.id,
    user: toOwnerDto(owner),
    lastMessageAt: conversation.lastMessageAt?.toISOString() ?? null,
    lastMessage: lastMessage ? toChatMessageDto(lastMessage) : null,
    unreadCount,
    createdAt: conversation.createdAt.toISOString(),
  };
}

export function toConversationsResponse(
  page: ConversationPage,
): ConversationsResponseDto {
  return paginated(
    'conversations',
    page.conversations.map(toConversationDto),
    page.total,
  );
}
