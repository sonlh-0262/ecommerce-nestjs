import { UserRole } from '../enums/user-role.enum';
import { UserStatus } from '../enums/user-status.enum';

/**
 * What `UsersService.create` needs. The password arrives already hashed: the
 * service never sees a plaintext password, so it cannot log one by accident.
 *
 * `role`, `status` and `emailVerifiedAt` default to a pending, unprivileged
 * account; only a seeder or an admin flow passes them. Setting `status` to
 * `ACTIVE` without `emailVerifiedAt` is rejected by
 * `CHK_users_verified_status`, not silently accepted.
 */
export interface CreateUserInput {
  email: string;
  username: string;
  passwordHash: string;
  fullName?: string | null;
  role?: UserRole;
  status?: UserStatus;
  emailVerifiedAt?: Date | null;
}
