import { ExecutionContext } from '@nestjs/common';

import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { AuthenticatedSocket } from '../sockets/authenticated-socket';

export function authenticatedUser(
  context: ExecutionContext,
): AuthenticatedUser {
  const { user } =
    context.getType() === 'ws'
      ? context.switchToWs().getClient<AuthenticatedSocket>().data
      : context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();

  if (!user) {
    throw new Error(
      'No authenticated user on the request. Remove @Public() from this route.',
    );
  }

  return user;
}
