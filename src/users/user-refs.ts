import { In, Repository } from 'typeorm';

import { UserRef } from './dto/user-ref.dto';
import { User } from './entities/user.entity';

export async function loadUserRefs(
  users: Repository<User>,
  ids: string[],
): Promise<Map<string, UserRef>> {
  const unique = [...new Set(ids)];

  if (unique.length === 0) {
    return new Map();
  }

  const found = await users.find({
    where: { id: In(unique) },
    select: { id: true, email: true, username: true, fullName: true },
    withDeleted: true,
  });

  return new Map(found.map((user) => [user.id, user]));
}
