import { ExecutionContext } from '@nestjs/common';

import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';

export function authenticatedUser(
  context: ExecutionContext,
): AuthenticatedUser {
  const { user } = context
    .switchToHttp()
    .getRequest<{ user?: AuthenticatedUser }>();

  if (!user) {
    throw new Error(
      'No authenticated user on the request. Remove @Public() from this route.',
    );
  }

  return user;
}
