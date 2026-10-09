import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AttachmentsController } from './attachments.controller';
import { AttachmentsService } from './attachments.service';
import { CloseStreamInterceptor } from './download/close-stream.interceptor';
import { Attachment } from './entities/attachment.entity';
import { LocalStorageService } from './storage/local-storage.service';
import { ImageFileValidator } from './validators/file.validator';

@Module({
  imports: [TypeOrmModule.forFeature([Attachment])],
  controllers: [AttachmentsController],
  providers: [
    AttachmentsService,
    LocalStorageService,
    ImageFileValidator,
    CloseStreamInterceptor,
  ],
  exports: [AttachmentsService],
})
export class AttachmentsModule {}
