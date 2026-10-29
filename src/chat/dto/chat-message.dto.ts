import { ApiProperty } from '@nestjs/swagger';

import { Message } from '../entities/message.entity';

export class ChatMessageDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  conversationId: string;

  @ApiProperty({
    format: 'uuid',
    description:
      'The conversation owner, or the admin who answered. Compare it with ' +
      '`conversation.user.id` to tell the two sides apart.',
  })
  senderId: string;

  @ApiProperty({ example: 'Đơn hàng của tôi khi nào được giao?' })
  content: string;

  @ApiProperty({
    nullable: true,
    description: 'When the other side read it (ISO 8601), null while unread.',
    example: null,
  })
  readAt: string | null;

  @ApiProperty({
    description: 'Also the cursor for the next, older page.',
    example: '2026-10-29T08:30:00.000Z',
  })
  createdAt: string;
}

export class ChatMessageResponseDto {
  @ApiProperty({ type: ChatMessageDto })
  message: ChatMessageDto;
}

export class ChatMessagesResponseDto {
  @ApiProperty({ type: [ChatMessageDto], description: 'Newest first.' })
  messages: ChatMessageDto[];
}

export function toChatMessageDto(message: Message): ChatMessageDto {
  return {
    id: message.id,
    conversationId: message.conversationId,
    senderId: message.senderId,
    content: message.content,
    readAt: message.readAt?.toISOString() ?? null,
    createdAt: message.createdAt.toISOString(),
  };
}

export function toChatMessageResponse(
  message: Message,
): ChatMessageResponseDto {
  return { message: toChatMessageDto(message) };
}

export function toChatMessagesResponse(
  messages: Message[],
): ChatMessagesResponseDto {
  return { messages: messages.map(toChatMessageDto) };
}
