import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  Patch,
  Query,
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
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ParseUuidPipe } from '../common/pipes/parse-uuid.pipe';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/enums/user-role.enum';
import { ReviewSuggestionDto } from './dto/review-suggestion.dto';
import {
  AdminSuggestionResponseDto,
  AdminSuggestionsResponseDto,
  toAdminSuggestionResponse,
  toAdminSuggestionsResponse,
} from './dto/suggestion.dto';
import { SuggestionsQueryDto } from './dto/suggestions-query.dto';
import { ProductSuggestionsViewService } from './product-suggestions-view.service';
import { ProductSuggestionsService } from './product-suggestions.service';

@ApiTags('Admin - Product suggestions')
@ApiBearerAuth(SWAGGER_BEARER_AUTH_NAME)
@ApiErrorResponse(HttpStatus.UNAUTHORIZED, 'Missing, invalid or revoked token.')
@ApiErrorResponse(
  HttpStatus.FORBIDDEN,
  'The caller is not an admin, or has been locked.',
)
@Roles(UserRole.Admin)
@Controller('admin/product-suggestions')
export class ProductSuggestionsAdminController {
  constructor(
    private readonly suggestions: ProductSuggestionsService,
    private readonly view: ProductSuggestionsViewService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List every suggestion',
    description: 'Newest first, with who sent each one.',
  })
  @ApiOkResponse({ type: AdminSuggestionsResponseDto })
  @ApiErrorResponse(HttpStatus.BAD_REQUEST, 'A query parameter is invalid.')
  async list(
    @Query() query: SuggestionsQueryDto,
  ): Promise<AdminSuggestionsResponseDto> {
    return toAdminSuggestionsResponse(await this.view.adminList(query));
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Approve or reject a suggestion',
    description:
      'Only once, while it is PENDING. Rejecting needs a note. Approving ' +
      'does not create the product: add it through /admin/products.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: AdminSuggestionResponseDto })
  @ApiErrorResponse(
    HttpStatus.BAD_REQUEST,
    'The id is not a uuid, or the payload failed validation.',
  )
  @ApiErrorResponse(HttpStatus.NOT_FOUND, 'No suggestion has this id.')
  @ApiErrorResponse(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'The suggestion was already reviewed, or a rejection has no note.',
  )
  async review(
    @CurrentUser() admin: User,
    @Param('id', ParseUuidPipe) id: string,
    @Body() dto: ReviewSuggestionDto,
  ): Promise<AdminSuggestionResponseDto> {
    return toAdminSuggestionResponse(
      await this.suggestions.review(admin, id, dto.suggestion),
    );
  }
}
