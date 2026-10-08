import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { DataSource } from 'typeorm';

import { AttachmentsService } from '../attachments/attachments.service';
import { AttachableType } from '../attachments/enums/attachable-type.enum';
import { UploadedImage } from '../attachments/interfaces/uploaded-image.interface';
import { User } from './entities/user.entity';
import { lockUser } from './lock-user';

@Injectable()
export class UserAvatarsService {
  private readonly logger = new Logger(UserAvatarsService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly attachments: AttachmentsService,
    private readonly i18n: I18nService,
  ) {}

  async urlsOf(userIds: string[]): Promise<Map<string, string>> {
    const byOwner = await this.attachments.findForOwner(
      AttachableType.User,
      userIds,
    );

    return new Map(
      [...byOwner].map(([userId, [avatar]]) => [userId, avatar.url]),
    );
  }

  async urlOf(userId: string): Promise<string | null> {
    return (await this.urlsOf([userId])).get(userId) ?? null;
  }

  async replace(
    user: User,
    upload: UploadedImage | undefined,
  ): Promise<string> {
    const image = this.attachments.validate(upload);

    const avatar = await this.dataSource.transaction(async (manager) => {
      if (!(await lockUser(manager, user.id))) {
        throw new NotFoundException(this.i18n.t('users.NOT_FOUND'));
      }

      const owned = await this.attachments.findForOwner(
        AttachableType.User,
        [user.id],
        manager,
      );
      const [current] = owned.get(user.id) ?? [];

      if (current) {
        await this.attachments.detach(manager, current.id);
      }

      return this.attachments.attach(manager, image, {
        type: AttachableType.User,
        id: user.id,
      });
    });

    this.logger.log(`Replaced the avatar of user ${user.id}`);

    return avatar.url;
  }
}
