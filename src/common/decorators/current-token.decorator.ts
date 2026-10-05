import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { TokenIdentity } from '../../auth/interfaces/token-identity.interface';

/**
 * The access token the current request was authenticated with.
 *
 * Only what logout needs - which token, and when it expires - so a handler
 * cannot reach for the whole account by accident.
 */
export const CurrentToken = createParamDecorator(
  (_data: unknown, context: ExecutionContext): TokenIdentity => {
    const { user } = context
      .switchToHttp()
      .getRequest<{ user?: AuthenticatedUser }>();

    if (!user) {
      throw new Error(
        'No authenticated user on the request. Remove @Public() from this route.',
      );
    }

    return { jti: user.jti, expiresAt: user.expiresAt };
  },
);
