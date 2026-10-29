import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { I18nService } from 'nestjs-i18n';
import { In, IsNull, LessThan, Not, Repository } from 'typeorm';

import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { User } from '../users/entities/user.entity';
import { conversationScope, incomingFromOwner, isAdmin } from './chat-access';
import { NO_UNREAD } from './chat.constants';
import { MessagesQueryDto } from './dto/messages-query.dto';
import { Conversation } from './entities/conversation.entity';
import { Message } from './entities/message.entity';
import {
  ConversationOwner,
  ConversationPage,
  UnreadCounts,
  UnreadRow,
} from './interfaces/conversation-view.interface';

@Injectable()
export class ChatViewService {
  constructor(
    @InjectRepository(Conversation)
    private readonly conversationsRepository: Repository<Conversation>,
    @InjectRepository(Message)
    private readonly messagesRepository: Repository<Message>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly i18n: I18nService,
  ) {}

  async conversations(
    viewer: User,
    { limit, offset }: PaginationQueryDto,
  ): Promise<ConversationPage> {
    const [conversations, total] =
      await this.conversationsRepository.findAndCount({
        where: isAdmin(viewer)
          ? { lastMessageAt: Not(IsNull()) }
          : { userId: viewer.id },
        order: { lastMessageAt: 'DESC', id: 'DESC' },
        skip: offset,
        take: limit,
      });

    if (conversations.length === 0) {
      return { conversations: [], total };
    }

    const ids = conversations.map(({ id }) => id);
    const [owners, lastMessages, unread] = await Promise.all([
      this.ownersOf(conversations),
      this.lastMessagesOf(ids),
      this.unreadCountsOf(ids),
    ]);

    return {
      conversations: conversations.map((conversation) => {
        const counts = unread.get(conversation.id) ?? NO_UNREAD;

        return {
          conversation,
          owner: owners.get(conversation.userId) as ConversationOwner,
          lastMessage: lastMessages.get(conversation.id) ?? null,
          unreadCount: incomingFromOwner(conversation, viewer)
            ? counts.fromOwner
            : counts.fromAdmins,
        };
      }),
      total,
    };
  }

  async messages(
    viewer: User,
    conversationId: string,
    { before, limit }: MessagesQueryDto,
  ): Promise<Message[]> {
    await this.findAccessible(viewer, conversationId);

    return this.messagesRepository.find({
      where: {
        conversationId,
        createdAt: before ? LessThan(new Date(before)) : undefined,
      },
      order: { createdAt: 'DESC', id: 'DESC' },
      take: limit,
    });
  }

  async findAccessible(viewer: User, id: string): Promise<Conversation> {
    const conversation = await this.conversationsRepository.findOneBy(
      conversationScope(viewer, id),
    );

    if (!conversation) {
      throw new NotFoundException(this.i18n.t('chat.CONVERSATION_NOT_FOUND'));
    }

    return conversation;
  }

  private async ownersOf(
    conversations: Conversation[],
  ): Promise<Map<string, ConversationOwner>> {
    const users = await this.usersRepository.find({
      where: {
        id: In([...new Set(conversations.map(({ userId }) => userId))]),
      },
      select: { id: true, email: true, username: true, fullName: true },
      withDeleted: true,
    });

    return new Map(users.map((user) => [user.id, user]));
  }

  private async lastMessagesOf(ids: string[]): Promise<Map<string, Message>> {
    const messages = await this.messagesRepository
      .createQueryBuilder('message')
      .distinctOn(['message.conversationId'])
      .where('message.conversationId IN (:...ids)', { ids })
      .orderBy('message.conversationId')
      .addOrderBy('message.createdAt', 'DESC')
      .addOrderBy('message.id', 'DESC')
      .getMany();

    return new Map(
      messages.map((message) => [message.conversationId, message]),
    );
  }

  private async unreadCountsOf(
    ids: string[],
  ): Promise<Map<string, UnreadCounts>> {
    const rows = await this.messagesRepository
      .createQueryBuilder('message')
      .innerJoin('message.conversation', 'conversation')
      .select('message.conversationId', 'conversationId')
      .addSelect('message.senderId = conversation.userId', 'fromOwner')
      .addSelect('COUNT(*)::int', 'count')
      .where('message.conversationId IN (:...ids)', { ids })
      .andWhere('message.readAt IS NULL')
      .groupBy('message.conversationId')
      .addGroupBy('"fromOwner"')
      .getRawMany<UnreadRow>();

    const counts = new Map<string, UnreadCounts>();

    for (const { conversationId, fromOwner, count } of rows) {
      const current = counts.get(conversationId) ?? NO_UNREAD;

      counts.set(
        conversationId,
        fromOwner
          ? { ...current, fromOwner: count }
          : { ...current, fromAdmins: count },
      );
    }

    return counts;
  }
}
