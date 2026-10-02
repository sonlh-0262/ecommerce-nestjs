import { ForbiddenException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';

import { User } from '../users/entities/user.entity';
import { ACCOUNT_STATUS_REJECTIONS } from './auth.constants';

/**
 * Refuses an account that exists but may not be used.
 *
 * Shared by login and by `JwtStrategy`: an admin who locks an account has to
 * stop the sessions it already has, not only its next login, and both paths
 * must give the same reason for it.
 *
 * 403 rather than 401 - the credentials were right, the account is not usable.
 */
export function assertAccountActive(user: User, i18n: I18nService): void {
  const messageKey = ACCOUNT_STATUS_REJECTIONS[user.status];

  if (messageKey) {
    throw new ForbiddenException(i18n.t(messageKey));
  }
}
