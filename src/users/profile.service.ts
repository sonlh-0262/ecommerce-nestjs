import {
  Injectable,
  Logger,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { DataSource } from 'typeorm';

import { definedFields } from '../common/helpers/defined-fields';
import { ChangePasswordBodyDto } from './dto/change-password.dto';
import { UpdateProfileBodyDto } from './dto/update-profile.dto';
import { User } from './entities/user.entity';
import { UserTokenType } from './enums/user-token-type.enum';
import { PasswordService } from './password.service';
import { UserTokensService } from './user-tokens.service';
import { UsersService } from './users.service';

@Injectable()
export class ProfileService {
  private readonly logger = new Logger(ProfileService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly usersService: UsersService,
    private readonly passwordService: PasswordService,
    private readonly userTokens: UserTokensService,
    private readonly i18n: I18nService,
  ) {}

  async updateProfile(user: User, input: UpdateProfileBodyDto): Promise<User> {
    const patch = definedFields(input);

    if (patch.username !== undefined && patch.username !== user.username) {
      await this.usersService.assertUsernameAvailable(patch.username);
    }

    const updated = await this.usersService.update(user, patch);

    this.logger.log(`Updated the profile of user ${updated.id}`);

    return updated;
  }

  async changePassword(
    user: User,
    { currentPassword, newPassword }: ChangePasswordBodyDto,
  ): Promise<void> {
    const stored = await this.usersService.findByIdWithPassword(user.id);
    const matches =
      stored !== null &&
      (await this.passwordService.compare(
        currentPassword,
        stored.passwordHash,
      ));

    if (!matches) {
      throw new UnauthorizedException(
        this.i18n.t('users.WRONG_CURRENT_PASSWORD'),
      );
    }

    if (newPassword === currentPassword) {
      throw new UnprocessableEntityException(
        this.i18n.t('users.PASSWORD_UNCHANGED'),
      );
    }

    const passwordHash = await this.passwordService.hash(newPassword);

    await this.dataSource.transaction(async (manager) => {
      await this.usersService.update(
        user,
        { passwordHash, passwordChangedAt: new Date() },
        manager,
      );
      await this.userTokens.retire(
        manager,
        user.id,
        UserTokenType.ResetPassword,
      );
    });

    this.logger.log(`Changed the password of user ${user.id}`);
  }
}
