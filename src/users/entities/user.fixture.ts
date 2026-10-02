import { UserRole } from '../enums/user-role.enum';
import { UserStatus } from '../enums/user-status.enum';
import { User } from './user.entity';

/**
 * A fully populated, active account for unit tests.
 *
 * Shared rather than rebuilt per spec file: every field has to be present for
 * the DTO mapper to be exercised honestly, and three copies of that object
 * would drift apart the first time a column is added.
 *
 * Excluded from the production build by `tsconfig.build.json`.
 */
export function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: '0d3d3f4e-0000-4000-8000-000000000001',
    email: 'son@example.com',
    username: 'sonlh',
    passwordHash: 'hashed-password',
    passwordChangedAt: null,
    fullName: 'Lanh Hung Son',
    phone: '0901234567',
    address: '1 Nguyen Trai, Ha Noi',
    role: UserRole.User,
    status: UserStatus.Active,
    emailVerifiedAt: new Date('2026-09-20T02:10:00.000Z'),
    createdAt: new Date('2026-09-20T02:00:00.000Z'),
    updatedAt: new Date('2026-09-20T02:00:00.000Z'),
    deletedAt: null,
    ...overrides,
  };
}
