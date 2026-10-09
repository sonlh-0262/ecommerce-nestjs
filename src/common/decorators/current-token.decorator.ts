import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import { TokenIdentity } from '../../auth/interfaces/token-identity.interface';
import { authenticatedUser } from './authenticated-user';

/**
 * The access token the current request was authenticated with.
 *
 * Only what logout needs - which token, and when it expires - so a handler
 * cannot reach for the whole account by accident.
 */
export const CurrentToken = createParamDecorator(
  (_data: unknown, context: ExecutionContext): TokenIdentity => {
    const { jti, expiresAt } = authenticatedUser(context);

    return { jti, expiresAt };
  },
);
