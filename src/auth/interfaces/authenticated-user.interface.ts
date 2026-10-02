import { User } from '../../users/entities/user.entity';
import { TokenIdentity } from './token-identity.interface';

/** What `JwtStrategy` puts on the request once a token has been verified. */
export interface AuthenticatedUser extends TokenIdentity {
  user: User;
}
