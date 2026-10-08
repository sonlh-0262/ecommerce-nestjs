import {
  Controller,
  Get,
  Header,
  HttpStatus,
  Logger,
  Param,
  Res,
  StreamableFile,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Response } from 'express';

import { SWAGGER_BEARER_AUTH_NAME } from '../common/constants/swagger';
import { ApiErrorResponse } from '../common/decorators/api-error-response.decorator';
import { ParseUuidPipe } from '../common/pipes/parse-uuid.pipe';
import {
  ALLOWED_IMAGE_TYPES,
  ATTACHMENT_CACHE_CONTROL,
  ATTACHMENTS_ROUTE,
} from './attachments.constants';
import { AttachmentsService } from './attachments.service';
import { asciiFallback } from './storage/file-name';

@ApiTags('Attachments')
@ApiBearerAuth(SWAGGER_BEARER_AUTH_NAME)
@Controller(ATTACHMENTS_ROUTE)
export class AttachmentsController {
  private readonly logger = new Logger(AttachmentsController.name);

  constructor(private readonly attachmentsService: AttachmentsService) {}

  @Get(':id')
  @Header('X-Content-Type-Options', 'nosniff')
  @ApiOperation({
    summary: 'Download an attachment',
    description:
      'Streams a stored file to a signed-in account. Files never change ' +
      'once stored, so the response may be cached privately for a year.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({
    description: 'The file, with the media type detected at upload.',
    content: Object.fromEntries(
      ALLOWED_IMAGE_TYPES.map((type) => [
        type,
        { schema: { type: 'string', format: 'binary' } },
      ]),
    ),
  })
  @ApiErrorResponse(HttpStatus.BAD_REQUEST, 'The id is not a uuid.')
  @ApiErrorResponse(HttpStatus.UNAUTHORIZED, 'Missing or invalid token.')
  @ApiErrorResponse(HttpStatus.FORBIDDEN, 'The account has been locked.')
  @ApiErrorResponse(
    HttpStatus.NOT_FOUND,
    'No such attachment, or its file is missing.',
  )
  async download(
    @Param('id', ParseUuidPipe) id: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const { attachment, stream } =
      await this.attachmentsService.openForDownload(id);

    response.once('close', () => stream.destroy());
    response.setHeader('Cache-Control', ATTACHMENT_CACHE_CONTROL);
    response.setHeader(
      'Content-Disposition',
      `inline; filename="${asciiFallback(attachment.fileName)}"; ` +
        `filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`,
    );

    return new StreamableFile(stream, {
      type: attachment.fileType,
      length: attachment.fileSize,
    }).setErrorHandler((error, res) => {
      this.logger.error(
        `Streaming attachment ${attachment.id} failed: ${error.message}`,
      );
      res.end();
    });
  }
}
