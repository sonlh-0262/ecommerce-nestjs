import { Not } from 'typeorm';

import { UserRole } from '../users/enums/user-role.enum';
import {
  conversationScope,
  incomingFromOwner,
  incomingSenders,
  isAdmin,
  roomOf,
  userRoom,
} from './chat-access';
import { ADMINS_ROOM } from './chat.constants';

describe('chat access rules', () => {
  const CUSTOMER = { id: 'u1', role: UserRole.User };
  const ADMIN = { id: 'a1', role: UserRole.Admin };
  const CONVERSATION = { userId: CUSTOMER.id };

  it('tells an admin from a customer', () => {
    expect(isAdmin(ADMIN)).toBe(true);
    expect(isAdmin(CUSTOMER)).toBe(false);
  });

  it('lets an admin reach any conversation by id', () => {
    expect(conversationScope(ADMIN, 'c1')).toEqual({ id: 'c1' });
  });

  it('keeps a customer to their own conversation', () => {
    expect(conversationScope(CUSTOMER, 'c1')).toEqual({
      id: 'c1',
      userId: CUSTOMER.id,
    });
  });

  it('makes the admin replies incoming for the owner', () => {
    expect(incomingFromOwner(CONVERSATION, CUSTOMER)).toBe(false);
    expect(incomingSenders(CONVERSATION, CUSTOMER)).toEqual(Not(CUSTOMER.id));
  });

  it('makes the owner messages incoming for an admin', () => {
    expect(incomingFromOwner(CONVERSATION, ADMIN)).toBe(true);
    expect(incomingSenders(CONVERSATION, ADMIN)).toBe(CUSTOMER.id);
  });

  it('puts a customer in their own room and every admin in one shared room', () => {
    expect(roomOf(CUSTOMER)).toBe(userRoom(CUSTOMER.id));
    expect(roomOf(ADMIN)).toBe(ADMINS_ROOM);
    expect(userRoom('u1')).toBe('user:u1');
  });
});
