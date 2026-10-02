import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { I18nService } from 'nestjs-i18n';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { AuthConfig, AUTH_CONFIG_KEY } from '../../config/auth.config';
import { User } from '../../users/entities/user.entity';
import { UsersService } from '../../users/users.service';
import { assertAccountActive } from '../account-status';
import { JWT_STRATEGY_NAME, MILLISECONDS_PER_SECOND } from '../auth.constants';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { TokenBlacklistService } from '../token-blacklist.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, JWT_STRATEGY_NAME) {
  constructor(
    private readonly usersService: UsersService,
    private readonly tokenBlacklist: TokenBlacklistService,
    private readonly i18n: I18nService,
    configService: ConfigService,
  ) {
    const config = configService.getOrThrow<AuthConfig>(AUTH_CONFIG_KEY);

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.jwtSecret,
      issuer: config.jwtIssuer,
    });
  }

  /**
   * Runs on every authenticated request, so the checks are ordered cheapest
   * first: one Redis lookup, then one row, then two comparisons in memory.
   *
   * A valid signature is not enough on its own - the account a token names may
   * have been logged out, deleted, locked, or had its password changed since.
   */
  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    if (await this.tokenBlacklist.isRevoked(payload.jti)) {
      throw new UnauthorizedException(this.i18n.t('auth.TOKEN_REVOKED'));
    }

    const user = await this.usersService.findById(payload.sub);

    if (!user) {
      throw new UnauthorizedException(this.i18n.t('auth.USER_NOT_FOUND'));
    }

    if (isIssuedBeforePasswordChange(payload, user)) {
      throw new UnauthorizedException(this.i18n.t('auth.PASSWORD_CHANGED'));
    }

    assertAccountActive(user, this.i18n);

    return { user, jti: payload.jti, expiresAt: payload.exp };
  }
}

/**
 * Whether a password change has outlived the token presented.
 *
 * Changing a password revokes every session at once, which the denylist cannot
 * express: the ids of the tokens still in the wild are unknown.
 */
function isIssuedBeforePasswordChange(
  payload: JwtPayload,
  user: User,
): boolean {
  if (!user.passwordChangedAt) {
    return false;
  }

  return (
    payload.iat * MILLISECONDS_PER_SECOND < user.passwordChangedAt.getTime()
  );
}
