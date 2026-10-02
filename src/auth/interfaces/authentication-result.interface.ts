import { User } from '../../users/entities/user.entity';
import { AuthSession } from './auth-session.interface';

/** What a successful login hands back: the account, and its new session. */
export interface AuthenticationResult {
  user: User;
  session: AuthSession;
}
