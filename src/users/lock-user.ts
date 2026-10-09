import { EntityManager } from 'typeorm';

import { User } from './entities/user.entity';

export function lockUser(
  manager: EntityManager,
  userId: string,
): Promise<User | null> {
  return manager.findOne(User, {
    where: { id: userId },
    lock: { mode: 'pessimistic_write' },
  });
}
