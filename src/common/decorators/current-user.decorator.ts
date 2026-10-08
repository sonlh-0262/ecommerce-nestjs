import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import { User } from '../../users/entities/user.entity';
import { authenticatedUser } from './authenticated-user';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): User =>
    authenticatedUser(context).user,
);
