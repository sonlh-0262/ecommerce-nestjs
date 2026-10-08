import { User } from '../users/entities/user.entity';

export function passwordVersion(
  user: Pick<User, 'passwordChangedAt'>,
): number | null {
  return user.passwordChangedAt?.getTime() ?? null;
}
