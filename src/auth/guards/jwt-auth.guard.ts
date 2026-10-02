import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { I18nService } from 'nestjs-i18n';

import { JWT_STRATEGY_NAME } from '../auth.constants';

@Injectable()
export class JwtAuthGuard extends AuthGuard(JWT_STRATEGY_NAME) {
  constructor(private readonly i18n: I18nService) {
    super();
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
}
