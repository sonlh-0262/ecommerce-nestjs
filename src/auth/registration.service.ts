import { Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { DataSource } from 'typeorm';

import { activationPatch } from '../users/account-activation';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/enums/user-role.enum';
import { UserStatus } from '../users/enums/user-status.enum';
import { UserTokenType } from '../users/enums/user-token-type.enum';
import { CreateUserInput } from '../users/interfaces/create-user-input.interface';
import { PasswordService } from '../users/password.service';
import { UserTokensService } from '../users/user-tokens.service';
import { UsersService } from '../users/users.service';
import { AccountLinksService } from './account-links.service';
import { INVITED_PASSWORD_BYTES } from './auth.constants';
import { InviteAdminBodyDto } from './dto/invite-admin.dto';
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

    const user = await this.createWithLink(
      {
        email: input.email,
        username: input.username,
        fullName: input.fullName || null,
        passwordHash: await this.passwordService.hash(input.password),
      },
      UserTokenType.EmailVerify,
    );

    this.logger.log(`Registered user ${user.username} (${user.id})`);

    return user;
  }

  async inviteAdmin(admin: User, input: InviteAdminBodyDto): Promise<User> {
    await this.usersService.assertAvailable(input.email, input.username);

    const user = await this.createWithLink(
      {
        email: input.email,
        username: input.username,
        fullName: input.fullName || null,
        passwordHash: await this.passwordService.hash(
          randomBytes(INVITED_PASSWORD_BYTES).toString('hex'),
        ),
        role: UserRole.Admin,
      },
      UserTokenType.Invitation,
    );

    this.logger.log(`Admin ${admin.id} invited admin ${user.id}`);

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

  private async createWithLink(
    input: CreateUserInput,
    type: UserTokenType,
  ): Promise<User> {
    const { user, token } = await this.dataSource.transaction(
      async (manager) => {
        const created = await this.usersService.create(input, manager);

        return {
          user: created,
          token: await this.userTokens.issue(manager, created.id, type),
        };
      },
    );

    await this.accountLinks.send(user, type, token);

    return user;
  }
}
