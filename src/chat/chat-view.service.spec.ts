import { NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { FindOperator, In, IsNull, LessThan, Not, Repository } from 'typeorm';

import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/enums/user-role.enum';
import { ChatViewService } from './chat-view.service';
import { Conversation } from './entities/conversation.entity';
import { Message } from './entities/message.entity';

describe('ChatViewService', () => {
  const CUSTOMER = { id: 'u1', role: UserRole.User } as User;
  const OTHER = { id: 'u2', role: UserRole.User } as User;
  const ADMIN = { id: 'a1', role: UserRole.Admin } as User;
  const OWNERS = [
    { id: 'u1', email: 'an@example.com', username: 'an', fullName: 'An' },
    { id: 'u2', email: 'binh@example.com', username: 'binh', fullName: null },
  ];

  const conversation = (id: string, userId: string) =>
    ({ id, userId, lastMessageAt: new Date() }) as Conversation;
  const message = (id: string, conversationId: string) =>
    ({ id, conversationId }) as Message;

  const queryBuilder = (result: { many?: unknown[]; raw?: unknown[] }) => {
    const builder: Record<string, jest.Mock> = {};

    for (const step of [
      'distinctOn',
      'where',
      'andWhere',
      'orderBy',
      'addOrderBy',
      'innerJoin',
      'select',
      'addSelect',
      'groupBy',
      'addGroupBy',
    ]) {
      builder[step] = jest.fn(() => builder);
    }

    builder.getMany = jest.fn(() => Promise.resolve(result.many ?? []));
    builder.getRawMany = jest.fn(() => Promise.resolve(result.raw ?? []));

    return builder;
  };

  const conversationsRepository = {
    findAndCount: jest.fn(),
    findOneBy: jest.fn(),
  };
  const messagesRepository = { find: jest.fn(), createQueryBuilder: jest.fn() };
  const usersRepository = { find: jest.fn() };
  const i18nMock = { t: jest.fn((key: string) => key) };

  const service = new ChatViewService(
    conversationsRepository as unknown as Repository<Conversation>,
    messagesRepository as unknown as Repository<Message>,
    usersRepository as unknown as Repository<User>,
    i18nMock as unknown as I18nService,
  );

  const query = { limit: 20, offset: 0 };

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('conversations', () => {
    const page = () => {
      conversationsRepository.findAndCount.mockResolvedValue([
        [conversation('c1', 'u1'), conversation('c2', 'u2')],
        2,
      ]);
      usersRepository.find.mockResolvedValue(OWNERS);
      messagesRepository.createQueryBuilder
        .mockReturnValueOnce(
          queryBuilder({ many: [message('m1', 'c1'), message('m2', 'c2')] }),
        )
        .mockReturnValueOnce(
          queryBuilder({
            raw: [
              { conversationId: 'c1', fromOwner: true, count: 3 },
              { conversationId: 'c1', fromOwner: false, count: 1 },
              { conversationId: 'c2', fromOwner: false, count: 4 },
            ],
          }),
        );
    };

    it('shows an admin every conversation with a message, latest first', async () => {
      page();

      const result = await service.conversations(ADMIN, query);

      expect(conversationsRepository.findAndCount).toHaveBeenCalledWith({
        where: { lastMessageAt: Not(IsNull()) },
        order: { lastMessageAt: 'DESC', id: 'DESC' },
        skip: 0,
        take: 20,
      });
      expect(result.total).toBe(2);
      expect(
        result.conversations.map(({ owner, lastMessage }) => [
          owner.username,
          lastMessage?.id,
        ]),
      ).toEqual([
        ['an', 'm1'],
        ['binh', 'm2'],
      ]);
    });

    it('counts for an admin only the unread messages of the customer', async () => {
      page();

      const { conversations } = await service.conversations(ADMIN, query);

      expect(conversations.map(({ unreadCount }) => unreadCount)).toEqual([
        3, 0,
      ]);
    });

    it('counts for the owner only the unread replies of the admins', async () => {
      conversationsRepository.findAndCount.mockResolvedValue([
        [conversation('c1', 'u1')],
        1,
      ]);
      usersRepository.find.mockResolvedValue([OWNERS[0]]);
      messagesRepository.createQueryBuilder
        .mockReturnValueOnce(queryBuilder({ many: [] }))
        .mockReturnValueOnce(
          queryBuilder({
            raw: [
              { conversationId: 'c1', fromOwner: true, count: 3 },
              { conversationId: 'c1', fromOwner: false, count: 1 },
            ],
          }),
        );

      const { conversations } = await service.conversations(CUSTOMER, query);

      expect(conversationsRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: CUSTOMER.id } }),
      );
      expect(conversations[0]).toMatchObject({
        unreadCount: 1,
        lastMessage: null,
      });
    });

    it('loads the owners of a page in one query', async () => {
      page();

      await service.conversations(ADMIN, query);

      expect(usersRepository.find).toHaveBeenCalledTimes(1);
      expect(usersRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: In(['u1', 'u2']) },
          withDeleted: true,
        }),
      );
      expect(messagesRepository.createQueryBuilder).toHaveBeenCalledTimes(2);
    });

    it('skips every follow-up query on an empty page', async () => {
      conversationsRepository.findAndCount.mockResolvedValue([[], 0]);

      await expect(service.conversations(ADMIN, query)).resolves.toEqual({
        conversations: [],
        total: 0,
      });
      expect(usersRepository.find).not.toHaveBeenCalled();
      expect(messagesRepository.createQueryBuilder).not.toHaveBeenCalled();
    });
  });

  describe('messages', () => {
    it('pages newest first from the cursor, never by offset', async () => {
      const BEFORE = '2026-10-29T08:30:00.000Z';

      conversationsRepository.findOneBy.mockResolvedValue(
        conversation('c1', 'u1'),
      );
      messagesRepository.find.mockResolvedValue([message('m1', 'c1')]);

      await expect(
        service.messages(CUSTOMER, 'c1', { before: BEFORE, limit: 2 }),
      ).resolves.toEqual([message('m1', 'c1')]);

      expect(messagesRepository.find).toHaveBeenCalledWith({
        where: {
          conversationId: 'c1',
          createdAt: LessThan(new Date(BEFORE)),
        },
        order: { createdAt: 'DESC', id: 'DESC' },
        take: 2,
      });
    });

    it('starts from the newest message without a cursor', async () => {
      conversationsRepository.findOneBy.mockResolvedValue(
        conversation('c1', 'u1'),
      );
      messagesRepository.find.mockResolvedValue([]);

      await service.messages(ADMIN, 'c1', { limit: 50 });

      const [[options]] = messagesRepository.find.mock.calls as [
        [{ where: { createdAt?: FindOperator<Date> } }],
      ];

      expect(options.where.createdAt).toBeUndefined();
    });

    it("answers 404 for someone else's conversation", async () => {
      conversationsRepository.findOneBy.mockResolvedValue(null);

      await expect(
        service.messages(OTHER, 'c1', { limit: 50 }),
      ).rejects.toThrow(new NotFoundException('chat.CONVERSATION_NOT_FOUND'));
      expect(conversationsRepository.findOneBy).toHaveBeenCalledWith({
        id: 'c1',
        userId: OTHER.id,
      });
      expect(messagesRepository.find).not.toHaveBeenCalled();
    });
  });
});
