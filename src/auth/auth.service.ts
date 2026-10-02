import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import { I18nService } from 'nestjs-i18n';

import { User } from '../users/entities/user.entity';
import { PasswordService } from '../users/password.service';
import { UsersService } from '../users/users.service';
import { assertAccountActive } from './account-status';
import { DUMMY_PASSWORD_HASH } from './auth.constants';
import { LoginUserBodyDto } from './dto/login.dto';
import { AuthSession } from './interfaces/auth-session.interface';
import { AuthenticationResult } from './interfaces/authentication-result.interface';
import {
  JwtPayload,
  JwtPayloadClaims,
} from './interfaces/jwt-payload.interface';
import { TokenBlacklistService } from './token-blacklist.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly passwordService: PasswordService,
    private readonly jwtService: JwtService,
    private readonly tokenBlacklist: TokenBlacklistService,
    private readonly i18n: I18nService,
  ) {}

  async login(input: LoginUserBodyDto): Promise<AuthenticationResult> {
    const user = await this.usersService.findByEmailWithPassword(input.email);

    // Compared even when no account was found, against a hash that cannot
    // match, so an unknown email takes as long to reject as a wrong password.
    const passwordMatches = await this.passwordService.compare(
      input.password,
      user?.passwordHash ?? DUMMY_PASSWORD_HASH,
    );

    if (!user || !passwordMatches) {
      throw new UnauthorizedException(this.i18n.t('auth.INVALID_CREDENTIALS'));
    }

    // Only once the password is known to be right: otherwise the status of an
    // account could be probed without knowing its password.
    assertAccountActive(user, this.i18n);

    // The hash was selected for the comparison alone and has no business
    // travelling any further up the call stack.
    delete (user as Partial<User>).passwordHash;

    this.logger.log(`Logged in user ${user.username} (${user.id})`);

    return { user, session: this.issueSession(user) };
  }

  async logout(jti: string, expiresAt: number): Promise<boolean> {
    const revoked = await this.tokenBlacklist.revoke(jti, expiresAt);

    if (revoked) {
      this.logger.log(`Logged out token ${jti}`);
    }

    return revoked;
  }

  /**
   * Public because registration will hand back a session too, and because the
   * e2e harness authenticates its fixtures with it - which keeps the suite
   * driving endpoints with the tokens the app really issues.
   */
  issueSession(user: User): AuthSession {
    const claims: JwtPayloadClaims = {
      sub: user.id,
      email: user.email,
      username: user.username,
    };

    const token = this.jwtService.sign(claims, { jwtid: randomUUID() });
    const { iat, exp } = this.jwtService.decode<JwtPayload>(token);

    return { token, expiresIn: exp - iat };
  }
}
