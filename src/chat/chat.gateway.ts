import { UseFilters, UseGuards, UsePipes } from '@nestjs/common';
import {
  MessageBody,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { WsExceptionsFilter } from '../common/filters/ws-exceptions.filter';
import { createValidationPipe } from '../common/pipes/validation.pipe';
import { RateLimit } from '../common/throttling/rate-limit.decorator';
import { WsThrottlerGuard } from '../common/throttling/ws-throttler.guard';
import { AuthenticatedNamespace } from '../common/sockets/authenticated-socket';
import { User } from '../users/entities/user.entity';
import { ChatSocketsService } from './chat-sockets.service';
import {
  CHAT_CORS,
  CHAT_EVENTS,
  CHAT_NAMESPACE,
  CHAT_RATE_LIMITS,
} from './chat.constants';
import { ChatService } from './chat.service';
import {
  ChatMessageResponseDto,
  toChatMessageResponse,
} from './dto/chat-message.dto';
import { SendMessageEventDto } from './dto/send-message.dto';

@UseFilters(WsExceptionsFilter)
@UseGuards(JwtAuthGuard, WsThrottlerGuard)
@UsePipes(createValidationPipe())
@WebSocketGateway({ namespace: CHAT_NAMESPACE, cors: CHAT_CORS })
export class ChatGateway implements OnGatewayInit<AuthenticatedNamespace> {
  constructor(
    private readonly chat: ChatService,
    private readonly sockets: ChatSocketsService,
  ) {}

  afterInit(server: AuthenticatedNamespace): void {
    this.sockets.attach(server);
  }

  @SubscribeMessage(CHAT_EVENTS.send)
  @RateLimit(CHAT_RATE_LIMITS.socketSend)
  async send(
    @CurrentUser() user: User,
    @MessageBody() event: SendMessageEventDto,
  ): Promise<ChatMessageResponseDto> {
    return toChatMessageResponse(
      await this.chat.send(user, event.conversationId, event),
    );
  }
}
