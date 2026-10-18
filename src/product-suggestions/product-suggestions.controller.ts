import { Body, Controller, Get, HttpStatus, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { SWAGGER_BEARER_AUTH_NAME } from '../common/constants/swagger';
import { ApiErrorResponse } from '../common/decorators/api-error-response.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RateLimit } from '../common/throttling/rate-limit.decorator';
import { User } from '../users/entities/user.entity';
import { CreateSuggestionDto } from './dto/create-suggestion.dto';
import {
  SuggestionResponseDto,
  SuggestionsResponseDto,
  toSuggestionResponse,
  toSuggestionsResponse,
} from './dto/suggestion.dto';
import { SuggestionsQueryDto } from './dto/suggestions-query.dto';
import {
  MAX_PENDING_SUGGESTIONS,
  SUGGESTIONS_RATE_LIMITS,
} from './product-suggestions.constants';
import { ProductSuggestionsViewService } from './product-suggestions-view.service';
import { ProductSuggestionsService } from './product-suggestions.service';

@ApiTags('Product suggestions')
@ApiBearerAuth(SWAGGER_BEARER_AUTH_NAME)
@ApiErrorResponse(HttpStatus.UNAUTHORIZED, 'Missing, invalid or revoked token.')
@ApiErrorResponse(HttpStatus.FORBIDDEN, 'The account has been locked.')
@Controller('product-suggestions')
export class ProductSuggestionsController {
  constructor(
    private readonly suggestions: ProductSuggestionsService,
    private readonly view: ProductSuggestionsViewService,
  ) {}

  @Post()
  @RateLimit(SUGGESTIONS_RATE_LIMITS.create)
  @ApiOperation({
    summary: 'Suggest a product the shop does not sell',
    description: `Starts PENDING until an admin reviews it. At most ${MAX_PENDING_SUGGESTIONS} may wait at once.`,
  })
  @ApiCreatedResponse({ type: SuggestionResponseDto })
  @ApiErrorResponse(HttpStatus.BAD_REQUEST, 'The payload failed validation.')
  @ApiErrorResponse(
    HttpStatus.CONFLICT,
    `I already have ${MAX_PENDING_SUGGESTIONS} suggestions waiting for review.`,
  )
  @ApiErrorResponse(HttpStatus.TOO_MANY_REQUESTS, 'Too many suggestions.')
  async create(
    @CurrentUser() user: User,
    @Body() dto: CreateSuggestionDto,
  ): Promise<SuggestionResponseDto> {
    return toSuggestionResponse(
      await this.suggestions.create(user, dto.suggestion),
    );
  }

  @Get()
  @ApiOperation({
    summary: 'List my suggestions',
    description: 'Only my own, newest first, with the admin decision.',
  })
  @ApiOkResponse({ type: SuggestionsResponseDto })
  @ApiErrorResponse(HttpStatus.BAD_REQUEST, 'A query parameter is invalid.')
  async list(
    @CurrentUser() user: User,
    @Query() query: SuggestionsQueryDto,
  ): Promise<SuggestionsResponseDto> {
    return toSuggestionsResponse(await this.view.list(user.id, query));
  }
}
