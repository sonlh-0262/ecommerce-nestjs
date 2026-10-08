import { User } from './entities/user.entity';
import { UserStatus } from './enums/user-status.enum';
import { UserPatch } from './interfaces/user-patch.interface';

export function activationPatch(user: User, at = new Date()): UserPatch {
  return user.status === UserStatus.Pending
    ? { status: UserStatus.Active, emailVerifiedAt: at }
    : {};
}
