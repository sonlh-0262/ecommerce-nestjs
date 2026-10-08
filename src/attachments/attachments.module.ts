import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AttachmentsController } from './attachments.controller';
import { AttachmentsService } from './attachments.service';
import { Attachment } from './entities/attachment.entity';
import { LocalStorageService } from './storage/local-storage.service';
import { ImageFileValidator } from './validators/file.validator';

@Module({
  imports: [TypeOrmModule.forFeature([Attachment])],
  controllers: [AttachmentsController],
  providers: [AttachmentsService, LocalStorageService, ImageFileValidator],
  exports: [AttachmentsService],
})
export class AttachmentsModule {}
