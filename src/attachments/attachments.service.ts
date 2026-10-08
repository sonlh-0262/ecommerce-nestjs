import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { I18nService } from 'nestjs-i18n';
import { Readable } from 'stream';
import { EntityManager, In, Repository } from 'typeorm';

import { APP_CONFIG_KEY, AppConfig } from '../config/configuration';
import { TransactionHooks } from '../database/transaction-hooks.service';
import { ATTACHMENTS_ROUTE } from './attachments.constants';
import { Attachment } from './entities/attachment.entity';
import { AttachableType } from './enums/attachable-type.enum';
import { AttachmentOwner } from './interfaces/attachment-owner.interface';
import {
  UploadedImage,
  ValidatedImage,
} from './interfaces/uploaded-image.interface';
import { sanitiseFileName } from './storage/file-name';
import {
  buildStoragePath,
  LocalStorageService,
} from './storage/local-storage.service';
import { ImageFileValidator } from './validators/file.validator';

@Injectable()
export class AttachmentsService {
  private readonly logger = new Logger(AttachmentsService.name);
  private readonly urlPrefix: string;

  constructor(
    @InjectRepository(Attachment)
    private readonly attachmentsRepository: Repository<Attachment>,
    private readonly storage: LocalStorageService,
    private readonly validator: ImageFileValidator,
    private readonly transactionHooks: TransactionHooks,
    private readonly i18n: I18nService,
    configService: ConfigService,
  ) {
    const { apiPrefix } = configService.getOrThrow<AppConfig>(APP_CONFIG_KEY);

    this.urlPrefix = apiPrefix
      ? `/${apiPrefix}/${ATTACHMENTS_ROUTE}`
      : `/${ATTACHMENTS_ROUTE}`;
  }

  validate(upload: UploadedImage | undefined): ValidatedImage {
    return this.validator.validate(upload);
  }

  async attach(
    manager: EntityManager,
    { buffer, originalname, type }: ValidatedImage,
    owner: AttachmentOwner,
  ): Promise<Attachment> {
    const id = randomUUID();
    const storagePath = buildStoragePath(new Date(), id, type.extension);

    try {
      await this.storage.save(storagePath, buffer);

      const repository = manager.getRepository(Attachment);
      const attachment = await repository.save(
        repository.create({
          id,
          attachableType: owner.type,
          attachableId: owner.id,
          url: `${this.urlPrefix}/${id}`,
          fileName: sanitiseFileName(originalname, type.extension),
          fileType: type.mime,
          fileSize: buffer.length,
          storagePath,
        }),
      );

      this.transactionHooks.afterRollback(manager, () =>
        this.storage.remove(storagePath),
      );

      this.logger.log(
        `Stored ${type.mime} attachment ${id} for ${owner.type} ${owner.id}`,
      );

      return attachment;
    } catch (error) {
      await this.storage.remove(storagePath);

      throw error;
    }
  }

  async detach(manager: EntityManager, attachmentId: string): Promise<void> {
    const repository = manager.getRepository(Attachment);
    const attachment = await repository.findOne({
      where: { id: attachmentId },
    });

    if (!attachment) {
      throw new NotFoundException(this.i18n.t('attachments.NOT_FOUND'));
    }

    await repository.delete({ id: attachment.id });

    await this.transactionHooks.afterCommit(manager, () =>
      this.storage.remove(attachment.storagePath),
    );

    this.logger.log(`Detached attachment ${attachment.id}`);
  }

  async findForOwner(
    type: AttachableType,
    ids: string[],
    manager: EntityManager = this.attachmentsRepository.manager,
  ): Promise<Map<string, Attachment[]>> {
    const byOwner = new Map<string, Attachment[]>();
    const uniqueIds = [...new Set(ids)];

    if (uniqueIds.length === 0) {
      return byOwner;
    }

    const attachments = await manager.getRepository(Attachment).find({
      where: { attachableType: type, attachableId: In(uniqueIds) },
      order: { createdAt: 'ASC', id: 'ASC' },
    });

    for (const attachment of attachments) {
      byOwner.set(attachment.attachableId, [
        ...(byOwner.get(attachment.attachableId) ?? []),
        attachment,
      ]);
    }

    return byOwner;
  }

  async openForDownload(
    id: string,
  ): Promise<{ attachment: Attachment; stream: Readable }> {
    const attachment = await this.attachmentsRepository.findOne({
      where: { id },
    });

    if (!attachment) {
      throw new NotFoundException(this.i18n.t('attachments.NOT_FOUND'));
    }

    const stream = await this.storage.openReadStream(attachment.storagePath);

    if (!stream) {
      this.logger.error(
        `Attachment ${id} has no file at "${attachment.storagePath}"`,
      );

      throw new NotFoundException(this.i18n.t('attachments.NOT_FOUND'));
    }

    return { attachment, stream };
  }
}
