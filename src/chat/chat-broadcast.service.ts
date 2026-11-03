import { Injectable } from '@nestjs/common';

import { AuthenticatedNamespace } from '../common/sockets/authenticated-socket';
import { userRoom } from './chat-access';
import { ADMINS_ROOM, CHAT_EVENTS } from './chat.constants';
import { toChatMessageResponse } from './dto/chat-message.dto';
import { Conversation } from './entities/conversation.entity';
import { Message } from './entities/message.entity';

@Injectable()
export class ChatBroadcastService {
  private server: AuthenticatedNamespace | null = null;

  bind(server: AuthenticatedNamespace): void {
    this.server = server;
  }

  messageCreated(
    conversation: Pick<Conversation, 'userId'>,
    message: Message,
  ): void {
    this.server
      ?.to([userRoom(conversation.userId), ADMINS_ROOM])
      .emit(CHAT_EVENTS.created, toChatMessageResponse(message));
  }
}
