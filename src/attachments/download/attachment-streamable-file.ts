import { StreamableFile } from '@nestjs/common';
import { StreamableFileOptions } from '@nestjs/common/file-stream/interfaces';
import { Readable } from 'stream';

export class AttachmentStreamableFile extends StreamableFile {
  constructor(
    stream: Readable,
    options: StreamableFileOptions,
    readonly cacheControl: string,
  ) {
    super(stream, options);
  }
}
