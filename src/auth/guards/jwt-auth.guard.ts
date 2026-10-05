import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { I18nService } from 'nestjs-i18n';

import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import { JWT_STRATEGY_NAME } from '../auth.constants';

@Injectable()
export class JwtAuthGuard extends AuthGuard(JWT_STRATEGY_NAME) {
  constructor(
    private readonly reflector: Reflector,
    private readonly i18n: I18nService,
  ) {
    super();
  }

  canActivate(context: ExecutionContext) {
    if (this.isPublic(context)) {
      return true;
    }

    return super.canActivate(context);
  }

  /**
   * Passport reports a missing, malformed or expired token as "no user" and no
   * error, which needs a message of our own. The rejections `JwtStrategy`
   * raises arrive here as real exceptions instead, and are rethrown so their
   * own status and message survive - a locked account must stay 403.
   */
  handleRequest<TUser>(
    error: unknown,
    user: TUser | false,
    _info: unknown,
  ): TUser {
    if (error) {
      throw error instanceof Error
        ? error
        : new UnauthorizedException(this.i18n.t('auth.UNAUTHORIZED'));
    }

    if (!user) {
      throw new UnauthorizedException(this.i18n.t('auth.UNAUTHORIZED'));
    }

    return user;
  }

  private isPublic(context: ExecutionContext): boolean {
    return (
      this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) === true
    );
  }
}
