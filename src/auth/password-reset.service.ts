import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { activationPatch } from '../users/account-activation';
import { User } from '../users/entities/user.entity';
import { UserTokenType } from '../users/enums/user-token-type.enum';
import { PasswordService } from '../users/password.service';
import { UserTokensService } from '../users/user-tokens.service';
import { UsersService } from '../users/users.service';
import { AccountLinksService } from './account-links.service';

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly usersService: UsersService,
    private readonly passwordService: PasswordService,
    private readonly userTokens: UserTokensService,
    private readonly accountLinks: AccountLinksService,
  ) {}

  async forgotPassword(email: string): Promise<void> {
    const user = await this.usersService.findByEmail(email);

    if (user) {
      await this.accountLinks.issueAndSend(user, UserTokenType.ResetPassword);
    }
  }

  async resetPassword(token: string, password: string): Promise<void> {
    const user = await this.setPassword(
      token,
      password,
      UserTokenType.ResetPassword,
    );

    this.logger.log(`Reset the password of user ${user.id}`);
  }

  async acceptInvitation(token: string, password: string): Promise<void> {
    const user = await this.setPassword(
      token,
      password,
      UserTokenType.Invitation,
    );

    this.logger.log(`User ${user.id} accepted an admin invitation`);
  }

  private async setPassword(
    token: string,
    password: string,
    type: UserTokenType,
  ): Promise<User> {
    const passwordHash = await this.passwordService.hash(password);

    return this.dataSource.transaction(async (manager) => {
      const owner = await this.userTokens.consume(manager, token, type);
      const now = new Date();

      return this.usersService.update(
        owner,
        {
          ...activationPatch(owner, now),
          passwordHash,
          passwordChangedAt: now,
        },
        manager,
      );
    });
  }
}
