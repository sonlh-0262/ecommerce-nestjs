import { UserRole } from '../../users/enums/user-role.enum';
import { SeedAccount } from './interfaces/seed-account.interface';

/**
 * Password every seeded account shares.
 *
 * Deliberately a known value: these rows exist so a developer can log in on a
 * fresh database. That is also why `run-seeds.ts` refuses to run in
 * production - a published password is only acceptable where nothing real is
 * behind it.
 */
export const SEED_PASSWORD = 'Password@123';

/** `NODE_ENV` the seeder refuses to run against. */
export const FORBIDDEN_SEED_ENVIRONMENT = 'production';

/**
 * The accounts a fresh database starts with: one of each role, both already
 * activated so they can log in without the email flow (which lands in B4).
 */
export const SEED_ACCOUNTS: readonly SeedAccount[] = [
  {
    email: 'admin@example.com',
    username: 'admin',
    fullName: 'Seed Admin',
    role: UserRole.Admin,
  },
  {
    email: 'son@example.com',
    username: 'sonlh',
    fullName: 'Lanh Hung Son',
    role: UserRole.User,
  },
];
