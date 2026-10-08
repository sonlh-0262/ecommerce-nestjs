import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { I18nService } from 'nestjs-i18n';
import { EntityManager, IsNull } from 'typeorm';

import { MILLISECONDS_PER_MINUTE } from '../common/constants/time';
import { UserToken } from './entities/user-token.entity';
import { User } from './entities/user.entity';
import { UserTokenType } from './enums/user-token-type.enum';
import { USER_TOKEN_BYTES, USER_TOKEN_TTL_MINUTES } from './users.constants';

const NOW = () => 'now()';

@Injectable()
export class UserTokensService {
  constructor(private readonly i18n: I18nService) {}

  async issue(
    manager: EntityManager,
    userId: string,
    type: UserTokenType,
  ): Promise<string> {
    await manager.findOne(User, {
      where: { id: userId },
      lock: { mode: 'pessimistic_write' },
    });
    await manager.update(
      UserToken,
      { userId, type, usedAt: IsNull() },
      { usedAt: NOW },
    );

    const token = randomBytes(USER_TOKEN_BYTES).toString('hex');

    await manager.insert(UserToken, {
      userId,
      type,
      tokenHash: hashToken(token),
      expiresAt: new Date(
        Date.now() + USER_TOKEN_TTL_MINUTES[type] * MILLISECONDS_PER_MINUTE,
      ),
    });

    return token;
  }

  async consume(
    manager: EntityManager,
    token: string,
    type: UserTokenType,
  ): Promise<User> {
    const result = await manager
      .createQueryBuilder()
      .update(UserToken)
      .set({ usedAt: NOW })
      .where('token_hash = :tokenHash', { tokenHash: hashToken(token) })
      .andWhere('type = :type', { type })
      .andWhere('used_at IS NULL')
      .andWhere('expires_at > now()')
      .returning('user_id')
      .execute();

    const [row] = result.raw as { user_id: string }[];
    const user = row
      ? await manager.findOne(User, { where: { id: row.user_id } })
      : null;

    if (!user) {
      throw new UnprocessableEntityException(this.i18n.t('auth.INVALID_TOKEN'));
    }

    return user;
  }
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
