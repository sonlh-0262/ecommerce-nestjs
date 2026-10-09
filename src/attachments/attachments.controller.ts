import {
  Controller,
  Get,
  Header,
  HttpStatus,
  Param,
  StreamableFile,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';

import { SWAGGER_BEARER_AUTH_NAME } from '../common/constants/swagger';
import { ApiErrorResponse } from '../common/decorators/api-error-response.decorator';
import { OptionalAuth } from '../common/decorators/optional-auth.decorator';
import { OptionalUser } from '../common/decorators/optional-user.decorator';
import { ParseUuidPipe } from '../common/pipes/parse-uuid.pipe';
import { User } from '../users/entities/user.entity';
import {
  ALLOWED_IMAGE_TYPES,
  ATTACHMENTS_ROUTE,
} from './attachments.constants';
import { AttachmentsService } from './attachments.service';
import { CacheControlInterceptor } from './download/cache-control.interceptor';
import { CloseStreamInterceptor } from './download/close-stream.interceptor';

@ApiTags('Attachments')
@ApiBearerAuth(SWAGGER_BEARER_AUTH_NAME)
@Controller(ATTACHMENTS_ROUTE)
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  @Get(':id')
  @OptionalAuth()
  @Header('X-Content-Type-Options', 'nosniff')
  @UseInterceptors(CloseStreamInterceptor, CacheControlInterceptor)
  @ApiOperation({
    summary: 'Download an attachment',
    description:
      'Streams a stored file. Product images are public; any other file ' +
      'needs a token. Files never change once stored, so the response may ' +
      'be cached for a year - publicly for product images, privately otherwise.',
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
  @ApiErrorResponse(
    HttpStatus.UNAUTHORIZED,
    'The file is not a product image and the token is missing or invalid.',
  )
  @ApiErrorResponse(HttpStatus.FORBIDDEN, 'The account has been locked.')
  @ApiErrorResponse(
    HttpStatus.NOT_FOUND,
    'No such attachment, or its file is missing.',
  )
  download(
    @Param('id', ParseUuidPipe) id: string,
    @OptionalUser() viewer: User | null,
  ): Promise<StreamableFile> {
    return this.attachmentsService.download(id, viewer);
  }
}
