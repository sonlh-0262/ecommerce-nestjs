import { Module } from '@nestjs/common';

import { SocketErrorsService } from './socket-errors.service';
import { SocketLanguageService } from './socket-language.service';

@Module({
  providers: [SocketErrorsService, SocketLanguageService],
  exports: [SocketErrorsService, SocketLanguageService],
})
export class SocketsModule {}
