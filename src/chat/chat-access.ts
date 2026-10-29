import { FindOperator, FindOptionsWhere, Not } from 'typeorm';

import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/enums/user-role.enum';
import { ADMINS_ROOM, USER_ROOM_PREFIX } from './chat.constants';
import { Conversation } from './entities/conversation.entity';

type Participant = Pick<User, 'id' | 'role'>;

export function isAdmin(user: Participant): boolean {
  return user.role === UserRole.Admin;
}

export function conversationScope(
  viewer: Participant,
  id: string,
): FindOptionsWhere<Conversation> {
  return isAdmin(viewer) ? { id } : { id, userId: viewer.id };
}

export function incomingFromOwner(
  conversation: Pick<Conversation, 'userId'>,
  viewer: Participant,
): boolean {
  return conversation.userId !== viewer.id;
}

export function incomingSenders(
  conversation: Pick<Conversation, 'userId'>,
  viewer: Participant,
): string | FindOperator<string> {
  return incomingFromOwner(conversation, viewer)
    ? conversation.userId
    : Not(conversation.userId);
}

export function userRoom(userId: string): string {
  return `${USER_ROOM_PREFIX}${userId}`;
}

export function roomOf(user: Participant): string {
  return isAdmin(user) ? ADMINS_ROOM : userRoom(user.id);
}
