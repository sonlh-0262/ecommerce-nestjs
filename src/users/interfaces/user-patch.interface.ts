import { User } from '../entities/user.entity';

export type UserPatch = Partial<
  Pick<
    User,
    | 'passwordHash'
    | 'passwordChangedAt'
    | 'status'
    | 'emailVerifiedAt'
    | 'username'
    | 'fullName'
    | 'phone'
    | 'address'
  >
>;
