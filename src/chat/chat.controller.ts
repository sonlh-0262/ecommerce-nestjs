import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';

import { SWAGGER_BEARER_AUTH_NAME } from '../common/constants/swagger';
import { ApiErrorResponse } from '../common/decorators/api-error-response.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import {
  MessageResponseDto,
  toMessageResponse,
} from '../common/dto/message-response.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { ParseUuidPipe } from '../common/pipes/parse-uuid.pipe';
import { RateLimit } from '../common/throttling/rate-limit.decorator';
import { User } from '../users/entities/user.entity';
import { ChatViewService } from './chat-view.service';
import { CHAT_RATE_LIMITS } from './chat.constants';
import { ChatService } from './chat.service';
import {
  ChatMessageResponseDto,
  ChatMessagesResponseDto,
  toChatMessageResponse,
  toChatMessagesResponse,
} from './dto/chat-message.dto';
import {
  ConversationsResponseDto,
  toConversationsResponse,
} from './dto/conversation.dto';
import { MessagesQueryDto } from './dto/messages-query.dto';
import { SendMessageDto } from './dto/send-message.dto';

@ApiTags('Chat')
@ApiBearerAuth(SWAGGER_BEARER_AUTH_NAME)
@ApiErrorResponse(HttpStatus.UNAUTHORIZED, 'Missing, invalid or revoked token.')
@ApiErrorResponse(HttpStatus.FORBIDDEN, 'The account has been locked.')
@Controller('chat/conversations')
export class ChatController {
  constructor(
    private readonly chat: ChatService,
    private readonly view: ChatViewService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List my conversations with the shop',
    description:
      'A customer sees their single conversation, opened on first call. An ' +
      'admin sees every conversation that has a message, latest first.',
  })
  @ApiOkResponse({ type: ConversationsResponseDto })
  @ApiErrorResponse(HttpStatus.BAD_REQUEST, 'A query parameter is invalid.')
  async list(
    @CurrentUser() user: User,
    @Query() query: PaginationQueryDto,
  ): Promise<ConversationsResponseDto> {
    return toConversationsResponse(await this.chat.conversations(user, query));
  }

  @Get(':id/messages')
  @ApiOperation({
    summary: 'Page through the messages of a conversation',
    description:
      'Newest first. Pass the `createdAt` of the oldest message shown as ' +
      '`before` to load the previous page.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: ChatMessagesResponseDto })
  @ApiErrorResponse(
    HttpStatus.BAD_REQUEST,
    'The id is not a uuid, or a query parameter is invalid.',
  )
  @ApiErrorResponse(
    HttpStatus.NOT_FOUND,
    'No conversation has this id, or it belongs to someone else.',
  )
  async messages(
    @CurrentUser() user: User,
    @Param('id', ParseUuidPipe) id: string,
    @Query() query: MessagesQueryDto,
  ): Promise<ChatMessagesResponseDto> {
    return toChatMessagesResponse(await this.view.messages(user, id, query));
  }

  @Post(':id/messages')
  @RateLimit(CHAT_RATE_LIMITS.send)
  @ApiOperation({
    summary: 'Send a message',
    description:
      'Also pushed as `message:new` to the customer and every admin ' +
      'connected to the /chat socket namespace.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiCreatedResponse({ type: ChatMessageResponseDto })
  @ApiErrorResponse(
    HttpStatus.BAD_REQUEST,
    'The id is not a uuid, or the payload failed validation.',
  )
  @ApiErrorResponse(
    HttpStatus.NOT_FOUND,
    'No conversation has this id, or it belongs to someone else.',
  )
  @ApiErrorResponse(HttpStatus.TOO_MANY_REQUESTS, 'Too many messages.')
  async send(
    @CurrentUser() user: User,
    @Param('id', ParseUuidPipe) id: string,
    @Body() dto: SendMessageDto,
  ): Promise<ChatMessageResponseDto> {
    return toChatMessageResponse(await this.chat.send(user, id, dto.message));
  }

  @Post(':id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mark the messages from the other side as read',
    description:
      'A customer marks the admin replies, an admin marks the customer ' +
      'messages. Messages the caller sent are never touched.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: MessageResponseDto })
  @ApiErrorResponse(HttpStatus.BAD_REQUEST, 'The id is not a uuid.')
  @ApiErrorResponse(
    HttpStatus.NOT_FOUND,
    'No conversation has this id, or it belongs to someone else.',
  )
  async read(
    @CurrentUser() user: User,
    @Param('id', ParseUuidPipe) id: string,
  ): Promise<MessageResponseDto> {
    return toMessageResponse(await this.chat.markRead(user, id));
  }
}
