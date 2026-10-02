import { UserRole } from '../../../users/enums/user-role.enum';

/**
 * One row in {@link SEED_ACCOUNTS}. Status and verification date are not
 * listed: every seeded account is activated, which the seeder applies once
 * rather than repeating per entry.
 */
export interface SeedAccount {
  email: string;
  username: string;
  fullName: string;
  role: UserRole;
}
