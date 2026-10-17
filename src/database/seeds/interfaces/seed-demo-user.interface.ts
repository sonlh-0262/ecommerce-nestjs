import { UserStatus } from '../../../users/enums/user-status.enum';

export interface SeedDemoUser {
  email: string;
  username: string;
  fullName: string;
  status: UserStatus.Active | UserStatus.Pending;
}
