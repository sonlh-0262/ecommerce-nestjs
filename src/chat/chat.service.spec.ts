import { Logger, NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { DataSource, EntityManager, IsNull, Not } from 'typeorm';

import { transactionalDataSource } from '../database/transaction.fixture';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/enums/user-role.enum';
import { ChatBroadcastService } from './chat-broadcast.service';
import { ChatViewService } from './chat-view.service';
import { MESSAGE_CLOCK_STEP_MS } from './chat.constants';
import { ChatService } from './chat.service';
import { Conversation } from './entities/conversation.entity';
import { Message } from './entities/message.entity';

describe('ChatService', () => {
  const CUSTOMER = { id: 'u1', role: UserRole.User } as User;
  const ADMIN = { id: 'a1', role: UserRole.Admin } as User;
  const LAST_MESSAGE_AT = new Date('2999-01-01T00:00:00.000Z');

  const conversation = (overrides: Partial<Conversation> = {}) =>
    ({
      id: 'c1',
      userId: CUSTOMER.id,
      lastMessageAt: null,
      ...overrides,
    }) as Conversation;

  const insertBuilder = {
    insert: jest.fn(),
    into: jest.fn(),
    values: jest.fn(),
    orIgnore: jest.fn(),
    execute: jest.fn(),
  };

  for (const step of ['insert', 'into', 'values', 'orIgnore'] as const) {
    insertBuilder[step].mockReturnValue(insertBuilder);
  }

  let log: jest.SpyInstance;

  const managerMock = {
    findOne: jest.fn(),
    create: jest.fn((_entity: unknown, values: object) => values),
    save: jest.fn((value: object) => Promise.resolve({ id: 'm1', ...value })),
    update: jest.fn(),
    existsBy: jest.fn(),
    createQueryBuilder: jest.fn(() => insertBuilder),
  };
  const { dataSource } = transactionalDataSource(
    managerMock as unknown as EntityManager,
  );
  const viewMock = {
    conversations: jest.fn(() =>
      Promise.resolve({ conversations: [], total: 0 }),
    ),
    findAccessible: jest.fn(),
  };
  const broadcastMock = { messageCreated: jest.fn() };
  const i18nMock = { t: jest.fn((key: string) => key) };

  const service = new ChatService(
    { ...dataSource, manager: managerMock } as unknown as DataSource,
    viewMock as unknown as ChatViewService,
    broadcastMock as unknown as ChatBroadcastService,
    i18nMock as unknown as I18nService,
  );

  beforeEach(() => {
    log = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    insertBuilder.execute.mockResolvedValue({ identifiers: [{ id: 'c1' }] });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  describe('conversations', () => {
    const QUERY = { limit: 20, offset: 0 };

    it('opens the conversation of a customer on first visit', async () => {
      managerMock.existsBy.mockResolvedValue(false);

      await service.conversations(CUSTOMER, QUERY);

      expect(managerMock.existsBy).toHaveBeenCalledWith(Conversation, {
        userId: CUSTOMER.id,
      });
      expect(insertBuilder.values).toHaveBeenCalledWith({
        userId: CUSTOMER.id,
      });
      expect(insertBuilder.orIgnore).toHaveBeenCalled();
      expect(log).toHaveBeenCalledWith(
        `Opened a conversation for user ${CUSTOMER.id}`,
      );
      expect(viewMock.conversations).toHaveBeenCalledWith(CUSTOMER, QUERY);
    });

    it('stays quiet when a concurrent request opened it first', async () => {
      managerMock.existsBy.mockResolvedValue(false);
      insertBuilder.execute.mockResolvedValue({ identifiers: [] });

      await service.conversations(CUSTOMER, QUERY);

      expect(log).not.toHaveBeenCalled();
      expect(viewMock.conversations).toHaveBeenCalledWith(CUSTOMER, QUERY);
    });

    it('opens it only once', async () => {
      managerMock.existsBy.mockResolvedValue(true);

      await service.conversations(CUSTOMER, QUERY);

      expect(insertBuilder.execute).not.toHaveBeenCalled();
    });

    it('never opens one for an admin', async () => {
      await service.conversations(ADMIN, QUERY);

      expect(managerMock.existsBy).not.toHaveBeenCalled();
      expect(viewMock.conversations).toHaveBeenCalledWith(ADMIN, QUERY);
    });
  });

  describe('send', () => {
    it('locks the conversation the sender may reach', async () => {
      managerMock.findOne.mockResolvedValue(conversation());

      await service.send(CUSTOMER, 'c1', { content: 'Xin chào' });

      expect(managerMock.findOne).toHaveBeenCalledWith(Conversation, {
        where: { id: 'c1', userId: CUSTOMER.id },
        lock: { mode: 'pessimistic_write' },
      });
    });

    it('stores the message and moves lastMessageAt to the same instant', async () => {
      managerMock.findOne.mockResolvedValue(conversation());

      const message = await service.send(ADMIN, 'c1', { content: 'Chào bạn' });

      expect(message).toMatchObject({
        id: 'm1',
        conversationId: 'c1',
        senderId: ADMIN.id,
        content: 'Chào bạn',
        readAt: null,
      });
      expect(managerMock.update).toHaveBeenCalledWith(
        Conversation,
        { id: 'c1' },
        { lastMessageAt: message.createdAt },
      );
    });

    it('stamps a message after the previous one even if the clock lags', async () => {
      managerMock.findOne.mockResolvedValue(
        conversation({ lastMessageAt: LAST_MESSAGE_AT }),
      );

      const message = await service.send(CUSTOMER, 'c1', { content: 'Hi' });

      expect(message.createdAt).toEqual(
        new Date(LAST_MESSAGE_AT.getTime() + MESSAGE_CLOCK_STEP_MS),
      );
    });

    it('pushes the message to both sides once committed', async () => {
      const stored = conversation();

      managerMock.findOne.mockResolvedValue(stored);

      const message = await service.send(CUSTOMER, 'c1', { content: 'Hi' });

      expect(broadcastMock.messageCreated).toHaveBeenCalledWith(
        stored,
        message,
      );
    });

    it("answers 404 for someone else's conversation and writes nothing", async () => {
      managerMock.findOne.mockResolvedValue(null);

      await expect(
        service.send(CUSTOMER, 'c1', { content: 'Hi' }),
      ).rejects.toThrow(new NotFoundException('chat.CONVERSATION_NOT_FOUND'));
      expect(managerMock.save).not.toHaveBeenCalled();
      expect(broadcastMock.messageCreated).not.toHaveBeenCalled();
    });
  });

  describe('markRead', () => {
    it('marks only the unread admin replies for the owner', async () => {
      viewMock.findAccessible.mockResolvedValue(conversation());
      managerMock.update.mockResolvedValue({ affected: 2 });

      await expect(service.markRead(CUSTOMER, 'c1')).resolves.toBe(
        'chat.MARKED_READ',
      );

      expect(viewMock.findAccessible).toHaveBeenCalledWith(CUSTOMER, 'c1');
      expect(managerMock.update).toHaveBeenCalledWith(
        Message,
        { conversationId: 'c1', readAt: IsNull(), senderId: Not(CUSTOMER.id) },
        { readAt: expect.any(Date) as Date },
      );
      expect(i18nMock.t).toHaveBeenCalledWith('chat.MARKED_READ', {
        args: { count: 2 },
      });
    });

    it('marks only the unread customer messages for an admin', async () => {
      viewMock.findAccessible.mockResolvedValue(conversation());
      managerMock.update.mockResolvedValue({});

      await service.markRead(ADMIN, 'c1');

      expect(managerMock.update).toHaveBeenCalledWith(
        Message,
        expect.objectContaining({ senderId: CUSTOMER.id }),
        expect.anything(),
      );
      expect(i18nMock.t).toHaveBeenCalledWith('chat.MARKED_READ', {
        args: { count: 0 },
      });
    });

    it('lets the 404 of an unreachable conversation through', async () => {
      const notFound = new NotFoundException('chat.CONVERSATION_NOT_FOUND');

      viewMock.findAccessible.mockRejectedValue(notFound);

      await expect(service.markRead(CUSTOMER, 'c1')).rejects.toBe(notFound);
      expect(managerMock.update).not.toHaveBeenCalled();
    });
  });
});
