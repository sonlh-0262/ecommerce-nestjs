import { AuthSession } from '../../../src/auth/interfaces/auth-session.interface';
import { User } from '../../../src/users/entities/user.entity';

/** A fixture account together with what a case needs to act as it. */
export interface SeededUser {
  user: User;
  password: string;
  session: AuthSession;
}
