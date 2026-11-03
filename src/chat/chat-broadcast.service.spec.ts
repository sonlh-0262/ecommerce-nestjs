import { AuthenticatedNamespace } from '../common/sockets/authenticated-socket';
import { ChatBroadcastService } from './chat-broadcast.service';
import { ADMINS_ROOM, CHAT_EVENTS } from './chat.constants';
import { toChatMessageResponse } from './dto/chat-message.dto';
import { Message } from './entities/message.entity';

describe('ChatBroadcastService', () => {
  const MESSAGE = {
    id: 'm1',
    conversationId: 'c1',
    senderId: 'u1',
    content: 'Xin chào',
    readAt: null,
    createdAt: new Date('2026-10-29T08:30:00.000Z'),
  } as Message;

  it('pushes a new message to its owner and to every admin', () => {
    const rooms = { emit: jest.fn() };
    const server = { to: jest.fn(() => rooms) };
    const service = new ChatBroadcastService();

    service.bind(server as unknown as AuthenticatedNamespace);
    service.messageCreated({ userId: 'u1' }, MESSAGE);

    expect(server.to).toHaveBeenCalledWith(['user:u1', ADMINS_ROOM]);
    expect(rooms.emit).toHaveBeenCalledWith(
      CHAT_EVENTS.created,
      toChatMessageResponse(MESSAGE),
    );
  });

  it('does nothing before the gateway is up', () => {
    expect(() =>
      new ChatBroadcastService().messageCreated({ userId: 'u1' }, MESSAGE),
    ).not.toThrow();
  });
});
