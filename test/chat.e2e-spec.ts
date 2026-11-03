import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { Socket } from 'socket.io-client';

import {
  CHAT_EVENTS,
  CHAT_RATE_LIMITS,
  MESSAGE_CONTENT_MAX_LENGTH,
} from '../src/chat/chat.constants';
import {
  ChatMessageDto,
  ChatMessageResponseDto,
  ChatMessagesResponseDto,
} from '../src/chat/dto/chat-message.dto';
import {
  ConversationDto,
  ConversationsResponseDto,
} from '../src/chat/dto/conversation.dto';
import { MessageResponseDto } from '../src/common/dto/message-response.dto';
import { SocketError } from '../src/common/sockets/socket-error.interface';
import { SOCKET_ERROR_EVENT } from '../src/common/sockets/sockets.constants';
import { UserRole } from '../src/users/enums/user-role.enum';
import { UserStatus } from '../src/users/enums/user-status.enum';
import {
  chatSocketUrl,
  ChatSocketOptions,
  connected,
  nextEvent,
  openChatSocket,
} from './support/chat-socket';
import { bearer, errorMessages } from './support/http';
import { SeededUser } from './support/interfaces/seeded-user.interface';
import { TestContext } from './support/interfaces/test-context.interface';
import { actingAs } from './support/shopper';
import { createTestApp } from './support/test-app';
import {
  AUTH_PATHS,
  CHAT_CONVERSATIONS_PATH,
  conversationMessagesPath,
  conversationReadPath,
} from './support/test.constants';

describe('Chat (e2e)', () => {
  const UNKNOWN_ID = '0d3d3f4e-0000-4000-8000-0000000000ff';

  let ctx: TestContext;
  let url: string;
  let admin: SeededUser;
  let customer: SeededUser;
  let sockets: Socket[];

  beforeAll(async () => {
    ctx = await createTestApp();
    url = await chatSocketUrl(ctx.app);
  });

  afterAll(async () => {
    await ctx.close();
  });

  beforeEach(async () => {
    sockets = [];
    admin = await ctx.users.createAuthenticated({ role: UserRole.Admin });
    customer = await ctx.users.createAuthenticated({
      fullName: 'Lanh Hung Son',
    });
  });

  afterEach(async () => {
    sockets.forEach((socket) => socket.disconnect());
    await ctx.reset();
  });

  const conversationsOf = async (user: SeededUser, query = '') =>
    (
      await actingAs(ctx, user)
        .get(`${CHAT_CONVERSATIONS_PATH}${query}`)
        .expect(200)
    ).body as ConversationsResponseDto;

  const conversationOf = async (user: SeededUser): Promise<ConversationDto> =>
    (await conversationsOf(user)).conversations[0];

  const send = (user: SeededUser, id: string, content: string, query = '') =>
    actingAs(ctx, user)
      .post(`${conversationMessagesPath(id)}${query}`)
      .send({ message: { content } });

  const sent = async (user: SeededUser, id: string, content: string) =>
    ((await send(user, id, content).expect(201)).body as ChatMessageResponseDto)
      .message;

  const page = async (user: SeededUser, id: string, query = '') =>
    (
      (
        await actingAs(ctx, user)
          .get(`${conversationMessagesPath(id)}${query}`)
          .expect(200)
      ).body as ChatMessagesResponseDto
    ).messages;

  const socketFor = (options: ChatSocketOptions) => {
    const socket = openChatSocket(url, options);

    sockets.push(socket);

    return socket;
  };

  const connect = (user: SeededUser, headers?: Record<string, string>) =>
    connected(socketFor({ token: user.session.token, headers }));

  describe('GET /chat/conversations', () => {
    it('opens exactly one conversation for a customer, on first visit', async () => {
      const first = await conversationsOf(customer);
      const second = await conversationsOf(customer);

      expect(first.conversationsCount).toBe(1);
      expect(second.conversations.map(({ id }) => id)).toEqual(
        first.conversations.map(({ id }) => id),
      );
      expect(first.conversations[0]).toMatchObject({
        user: { id: customer.user.id, fullName: 'Lanh Hung Son' },
        lastMessageAt: null,
        lastMessage: null,
        unreadCount: 0,
      });
    });

    it('shows an admin every conversation with a message, latest activity first', async () => {
      const quiet = await ctx.users.createAuthenticated();
      const other = await ctx.users.createAuthenticated();
      const mine = await conversationOf(customer);
      const theirs = await conversationOf(other);

      await conversationOf(quiet);
      await sent(other, theirs.id, 'Tin đầu tiên');
      await sent(customer, mine.id, 'Tin thứ hai');

      const { conversations, conversationsCount } =
        await conversationsOf(admin);

      expect(conversationsCount).toBe(2);
      expect(conversations.map(({ id }) => id)).toEqual([mine.id, theirs.id]);
      expect(conversations[0]).toMatchObject({
        lastMessage: { content: 'Tin thứ hai', senderId: customer.user.id },
        unreadCount: 1,
      });
    });

    it('never opens a conversation for an admin', async () => {
      await expect(conversationsOf(admin)).resolves.toEqual({
        conversations: [],
        conversationsCount: 0,
      });
    });

    it('needs a token', async () => {
      await request(ctx.server()).get(CHAT_CONVERSATIONS_PATH).expect(401);
    });
  });

  describe('messages', () => {
    it('lets the owner and an admin talk in the same conversation', async () => {
      const { id } = await conversationOf(customer);

      await sent(customer, id, 'Đơn của tôi khi nào giao?');
      await sent(admin, id, 'Chiều nay bạn nhé');

      expect(
        (await page(customer, id)).map(({ content, senderId }) => [
          content,
          senderId,
        ]),
      ).toEqual([
        ['Chiều nay bạn nhé', admin.user.id],
        ['Đơn của tôi khi nào giao?', customer.user.id],
      ]);
    });

    it('pages by cursor, unaffected by messages arriving in between', async () => {
      const { id } = await conversationOf(customer);

      for (const content of ['1', '2', '3']) {
        await sent(customer, id, content);
      }

      const first = await page(customer, id, '?limit=2');

      await sent(admin, id, '4');

      const second = await page(
        customer,
        id,
        `?limit=2&before=${encodeURIComponent(first[1].createdAt)}`,
      );

      expect(first.map(({ content }) => content)).toEqual(['3', '2']);
      expect(second.map(({ content }) => content)).toEqual(['1']);
    });

    it('gives messages sent in the same millisecond distinct, ordered instants', async () => {
      const { id } = await conversationOf(customer);

      const messages = await Promise.all(
        ['a', 'b', 'c', 'd'].map((content) => sent(customer, id, content)),
      );
      const instants = new Set(messages.map(({ createdAt }) => createdAt));

      const [newest] = await page(customer, id, '?limit=1');

      expect(instants.size).toBe(messages.length);
      expect((await conversationOf(customer)).lastMessageAt).toBe(
        newest.createdAt,
      );
    });

    it("answers 404, in the caller's language, for someone else's conversation", async () => {
      const stranger = await ctx.users.createAuthenticated();
      const { id } = await conversationOf(customer);

      const response = await actingAs(ctx, stranger)
        .get(`${conversationMessagesPath(id)}?lang=vi`)
        .expect(404);

      expect(errorMessages(response.body)).toEqual([
        'Không tìm thấy cuộc trò chuyện',
      ]);
      await send(stranger, id, 'Xin chào').expect(404);
      await actingAs(ctx, stranger).post(conversationReadPath(id)).expect(404);
    });

    it('answers 404 for an unknown conversation, even to an admin', async () => {
      await send(admin, UNKNOWN_ID, 'Xin chào').expect(404);
    });

    it.each([
      ['blank content', '   '],
      ['content too long', 'x'.repeat(MESSAGE_CONTENT_MAX_LENGTH + 1)],
    ])('refuses %s with 400', async (_case, content) => {
      const { id } = await conversationOf(customer);

      await send(customer, id, content).expect(400);
    });

    it.each([
      ['an id that is not a uuid', 'not-a-uuid', ''],
      ['a cursor that is not a date', null, '?before=yesterday'],
      ['a limit above the maximum', null, '?limit=101'],
    ])('refuses %s with 400', async (_case, id, query) => {
      const { id: own } = await conversationOf(customer);

      await actingAs(ctx, customer)
        .get(`${conversationMessagesPath(id ?? own)}${query}`)
        .expect(400);
    });
  });

  describe('POST /chat/conversations/:id/read', () => {
    it('marks only what the other side sent', async () => {
      const { id } = await conversationOf(customer);

      await sent(customer, id, 'Câu hỏi 1');
      await sent(customer, id, 'Câu hỏi 2');
      await sent(admin, id, 'Trả lời');

      const response = await actingAs(ctx, customer)
        .post(`${conversationReadPath(id)}?lang=vi`)
        .expect(200);

      expect((response.body as MessageResponseDto).message).toBe(
        'Đã đánh dấu 1 tin nhắn là đã đọc',
      );
      expect((await conversationOf(customer)).unreadCount).toBe(0);
      expect((await conversationsOf(admin)).conversations[0].unreadCount).toBe(
        2,
      );

      await actingAs(ctx, admin).post(conversationReadPath(id)).expect(200);

      const readBy = (messages: ChatMessageDto[]) =>
        messages.map(({ readAt }) => readAt !== null);

      expect(readBy(await page(admin, id))).toEqual([true, true, true]);
    });
  });

  describe('socket /chat', () => {
    it('connects with a valid token', async () => {
      expect((await connect(customer)).connected).toBe(true);
    });

    it.each([
      ['no token', undefined],
      ['a forged token', 'not.a.jwt'],
    ])('refuses a handshake with %s', async (_case, token) => {
      const socket = socketFor({ token, headers: { 'x-lang': 'vi' } });
      const error = await nextEvent<Error & { data: SocketError }>(
        socket,
        'connect_error',
      );

      expect(socket.connected).toBe(false);
      expect(error.data).toEqual({
        code: 'UNAUTHORIZED',
        message: 'Bạn cần đăng nhập để truy cập tài nguyên này',
      });
    });

    it('refuses the handshake of an expired token', async () => {
      const expired = ctx.app.get(JwtService).sign(
        {
          sub: customer.user.id,
          email: customer.user.email,
          username: customer.user.username,
          pwv: null,
        },
        { jwtid: 'expired-token', expiresIn: -10 },
      );
      const error = await nextEvent<Error & { data: SocketError }>(
        socketFor({ token: expired }),
        'connect_error',
      );

      expect(error.data.code).toBe('UNAUTHORIZED');
    });

    it('refuses the handshake of a locked account with 403', async () => {
      const locked = await ctx.users.createAuthenticated({
        status: UserStatus.Inactive,
      });
      const error = await nextEvent<Error & { data: SocketError }>(
        socketFor({ token: locked.session.token }),
        'connect_error',
      );

      expect(error.data.code).toBe('FORBIDDEN');
    });

    it('delivers a message sent by a customer to every admin, live', async () => {
      const { id } = await conversationOf(customer);
      const adminSocket = await connect(admin);
      const customerSocket = await connect(customer);
      const pushed = nextEvent<ChatMessageResponseDto>(
        adminSocket,
        CHAT_EVENTS.created,
      );

      const ack = (await customerSocket.emitWithAck(CHAT_EVENTS.send, {
        conversationId: id,
        content: 'Xin chào shop',
      })) as ChatMessageResponseDto;

      expect((await pushed).message).toEqual(ack.message);
      expect(ack.message).toMatchObject({
        conversationId: id,
        senderId: customer.user.id,
        content: 'Xin chào shop',
        readAt: null,
      });
      expect((await page(admin, id))[0].id).toBe(ack.message.id);
    });

    it('pushes a reply sent over REST to the customer, and to no one else', async () => {
      const stranger = await ctx.users.createAuthenticated();
      const { id } = await conversationOf(customer);
      const customerSocket = await connect(customer);
      const strangerSocket = await connect(stranger);
      const strangerEvents: unknown[] = [];

      strangerSocket.on(CHAT_EVENTS.created, (payload) =>
        strangerEvents.push(payload),
      );

      const pushed = nextEvent<ChatMessageResponseDto>(
        customerSocket,
        CHAT_EVENTS.created,
      );
      const reply = await sent(admin, id, 'Chiều nay bạn nhé');

      expect((await pushed).message).toEqual(reply);
      expect(strangerEvents).toEqual([]);
    });

    it('reports an invalid payload as an error event and keeps the socket open', async () => {
      const { id } = await conversationOf(customer);
      const socket = await connect(customer, { 'x-lang': 'vi' });
      const failed = nextEvent<SocketError>(socket, SOCKET_ERROR_EVENT);

      socket.emit(CHAT_EVENTS.send, { conversationId: id, content: '  ' });

      expect(await failed).toMatchObject({ code: 'BAD_REQUEST' });
      expect((await failed).message).toMatch(/content/);
      expect(socket.connected).toBe(true);

      const ack = (await socket.emitWithAck(CHAT_EVENTS.send, {
        conversationId: id,
        content: 'Thử lại',
      })) as ChatMessageResponseDto;

      expect(ack.message.content).toBe('Thử lại');
    });

    it("refuses someone else's conversation in the socket's language", async () => {
      const stranger = await ctx.users.createAuthenticated();
      const { id } = await conversationOf(customer);
      const socket = await connect(stranger, { 'x-lang': 'vi' });

      for (let attempt = 0; attempt < 2; attempt += 1) {
        const failed = nextEvent<SocketError>(socket, SOCKET_ERROR_EVENT);

        socket.emit(CHAT_EVENTS.send, { conversationId: id, content: 'Hi' });

        expect(await failed).toEqual({
          code: 'NOT_FOUND',
          message: 'Không tìm thấy cuộc trò chuyện',
        });
      }

      expect(socket.connected).toBe(true);
    });

    it('delivers an admin reply sent over the socket to the customer', async () => {
      const { id } = await conversationOf(customer);
      const customerSocket = await connect(customer);
      const adminSocket = await connect(admin);
      const pushed = nextEvent<ChatMessageResponseDto>(
        customerSocket,
        CHAT_EVENTS.created,
      );

      const ack = (await adminSocket.emitWithAck(CHAT_EVENTS.send, {
        conversationId: id,
        content: 'Shop đây, bạn cần gì?',
      })) as ChatMessageResponseDto;

      expect((await pushed).message).toEqual(ack.message);
      expect(ack.message.senderId).toBe(admin.user.id);
    });

    it('rate limits message:send per account, in the socket language', async () => {
      const { limit } = CHAT_RATE_LIMITS.socketSend;
      const { id } = await conversationOf(customer);
      const socket = await connect(customer, { 'x-lang': 'vi' });

      for (let index = 0; index < limit; index += 1) {
        await socket.emitWithAck(CHAT_EVENTS.send, {
          conversationId: id,
          content: `Tin ${index}`,
        });
      }

      const failed = nextEvent<SocketError>(socket, SOCKET_ERROR_EVENT);

      socket.emit(CHAT_EVENTS.send, { conversationId: id, content: 'Thêm' });

      expect(await failed).toEqual({
        code: 'TOO_MANY_REQUESTS',
        message: 'Bạn gửi quá nhiều yêu cầu, vui lòng thử lại sau',
      });
      expect(socket.connected).toBe(true);
      expect(await page(customer, id, '?limit=100')).toHaveLength(limit);
    });

    it('drops a socket whose token was logged out', async () => {
      const { id } = await conversationOf(customer);
      const socket = await connect(customer);

      await request(ctx.server())
        .post(AUTH_PATHS.logout)
        .set(...bearer(customer.session.token))
        .expect(200);

      const failed = nextEvent<SocketError>(socket, SOCKET_ERROR_EVENT);
      const dropped = nextEvent<string>(socket, 'disconnect');

      socket.emit(CHAT_EVENTS.send, { conversationId: id, content: 'Hi' });

      expect((await failed).code).toBe('UNAUTHORIZED');
      expect(await dropped).toBe('io server disconnect');
      expect(await page(admin, id)).toEqual([]);
    });
  });
});
