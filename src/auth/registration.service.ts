import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { activationPatch } from '../users/account-activation';
import { User } from '../users/entities/user.entity';
import { UserStatus } from '../users/enums/user-status.enum';
import { UserTokenType } from '../users/enums/user-token-type.enum';
import { PasswordService } from '../users/password.service';
import { UserTokensService } from '../users/user-tokens.service';
import { UsersService } from '../users/users.service';
import { AccountLinksService } from './account-links.service';
import { RegisterUserBodyDto } from './dto/register.dto';

@Injectable()
export class RegistrationService {
  private readonly logger = new Logger(RegistrationService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly usersService: UsersService,
    private readonly passwordService: PasswordService,
    private readonly userTokens: UserTokensService,
    private readonly accountLinks: AccountLinksService,
  ) {}

  async register(input: RegisterUserBodyDto): Promise<User> {
    await this.usersService.assertAvailable(input.email, input.username);

    const passwordHash = await this.passwordService.hash(input.password);

    const { user, token } = await this.dataSource.transaction(
      async (manager) => {
        const created = await this.usersService.create(
          {
            email: input.email,
            username: input.username,
            fullName: input.fullName || null,
            passwordHash,
          },
          manager,
        );

        return {
          user: created,
          token: await this.userTokens.issue(
            manager,
            created.id,
            UserTokenType.EmailVerify,
          ),
        };
      },
    );

    await this.accountLinks.send(user, UserTokenType.EmailVerify, token);
    this.logger.log(`Registered user ${user.username} (${user.id})`);

    return user;
  }

  verifyEmail(token: string): Promise<User> {
    return this.dataSource.transaction(async (manager) => {
      const user = await this.userTokens.consume(
        manager,
        token,
        UserTokenType.EmailVerify,
      );

      return this.usersService.update(user, activationPatch(user), manager);
    });
  }

  async resendVerification(email: string): Promise<void> {
    const user = await this.usersService.findByEmail(email);

    if (user?.status === UserStatus.Pending) {
      await this.accountLinks.issueAndSend(user, UserTokenType.EmailVerify);
    }
  }
}
