import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';

import { APP_CONFIG_KEY, AppConfig } from '../config/configuration';
import { MailQueueService } from '../mail/mail-queue.service';
import { User } from '../users/entities/user.entity';
import { UserTokenType } from '../users/enums/user-token-type.enum';
import { UserTokensService } from '../users/user-tokens.service';
import { USER_TOKEN_TTL_MINUTES } from '../users/users.constants';
import { ACCOUNT_LINKS } from './auth.constants';

@Injectable()
export class AccountLinksService {
  private readonly webUrl: string;

  constructor(
    private readonly dataSource: DataSource,
    private readonly userTokens: UserTokensService,
    private readonly mailQueue: MailQueueService,
    configService: ConfigService,
  ) {
    this.webUrl = configService.getOrThrow<AppConfig>(APP_CONFIG_KEY).webUrl;
  }

  async issueAndSend(user: User, type: UserTokenType): Promise<void> {
    const token = await this.dataSource.transaction((manager) =>
      this.userTokens.issue(manager, user.id, type),
    );

    await this.send(user, type, token);
  }

  send(user: User, type: UserTokenType, token: string): Promise<void> {
    const { job, path } = ACCOUNT_LINKS[type];

    return this.mailQueue.enqueue(job, {
      to: user.email,
      fullName: user.fullName,
      expiresInMinutes: USER_TOKEN_TTL_MINUTES[type],
      actionUrl: `${this.webUrl}${path}?${new URLSearchParams({ token }).toString()}`,
    });
  }
}
