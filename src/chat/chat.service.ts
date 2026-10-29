import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { DataSource, IsNull } from 'typeorm';

import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { User } from '../users/entities/user.entity';
import { conversationScope, incomingSenders, isAdmin } from './chat-access';
import { ChatBroadcastService } from './chat-broadcast.service';
import { ChatViewService } from './chat-view.service';
import { SendMessageBodyDto } from './dto/send-message.dto';
import { Conversation } from './entities/conversation.entity';
import { Message } from './entities/message.entity';
import { ConversationPage } from './interfaces/conversation-view.interface';
import { nextMessageTime } from './message-clock';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly view: ChatViewService,
    private readonly broadcast: ChatBroadcastService,
    private readonly i18n: I18nService,
  ) {}

  async conversations(
    viewer: User,
    query: PaginationQueryDto,
  ): Promise<ConversationPage> {
    if (!isAdmin(viewer)) {
      await this.open(viewer.id);
    }

    return this.view.conversations(viewer, query);
  }

  async send(
    sender: User,
    conversationId: string,
    { content }: SendMessageBodyDto,
  ): Promise<Message> {
    const { conversation, message } = await this.dataSource.transaction(
      async (manager) => {
        const conversation = await manager.findOne(Conversation, {
          where: conversationScope(sender, conversationId),
          lock: { mode: 'pessimistic_write' },
        });

        if (!conversation) {
          throw new NotFoundException(
            this.i18n.t('chat.CONVERSATION_NOT_FOUND'),
          );
        }

        const createdAt = nextMessageTime(conversation.lastMessageAt);
        const message = await manager.save(
          manager.create(Message, {
            conversationId,
            senderId: sender.id,
            content,
            readAt: null,
            createdAt,
          }),
        );

        await manager.update(
          Conversation,
          { id: conversationId },
          { lastMessageAt: createdAt },
        );

        return { conversation, message };
      },
    );

    this.broadcast.messageCreated(conversation, message);
    this.logger.log(
      `User ${sender.id} sent message ${message.id} to conversation ${conversationId}`,
    );

    return message;
  }

  async markRead(reader: User, conversationId: string): Promise<string> {
    const conversation = await this.view.findAccessible(reader, conversationId);
    const { affected } = await this.dataSource.manager.update(
      Message,
      {
        conversationId,
        readAt: IsNull(),
        senderId: incomingSenders(conversation, reader),
      },
      { readAt: new Date() },
    );

    return this.i18n.t('chat.MARKED_READ', { args: { count: affected ?? 0 } });
  }

  private async open(userId: string): Promise<void> {
    const manager = this.dataSource.manager;

    if (await manager.existsBy(Conversation, { userId })) {
      return;
    }

    const { identifiers } = await manager
      .createQueryBuilder()
      .insert()
      .into(Conversation)
      .values({ userId })
      .orIgnore()
      .execute();

    if (identifiers.some(Boolean)) {
      this.logger.log(`Opened a conversation for user ${userId}`);
    }
  }
}
