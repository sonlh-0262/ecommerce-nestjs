import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { SocketsModule } from '../common/sockets/sockets.module';
import { User } from '../users/entities/user.entity';
import { ChatBroadcastService } from './chat-broadcast.service';
import { ChatSocketsService } from './chat-sockets.service';
import { ChatViewService } from './chat-view.service';
import { ChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { Conversation } from './entities/conversation.entity';
import { Message } from './entities/message.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Conversation, Message, User]),
    AuthModule,
    SocketsModule,
  ],
  controllers: [ChatController],
  providers: [
    ChatService,
    ChatViewService,
    ChatBroadcastService,
    ChatSocketsService,
    ChatGateway,
  ],
})
export class ChatModule {}
