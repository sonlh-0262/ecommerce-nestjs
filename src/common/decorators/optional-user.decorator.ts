import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { User } from '../../users/entities/user.entity';

export const OptionalUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): User | null =>
    context.switchToHttp().getRequest<{ user?: AuthenticatedUser | null }>()
      .user?.user ?? null,
);
