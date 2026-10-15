import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';

import { SWAGGER_BEARER_AUTH_NAME } from '../common/constants/swagger';
import { ApiErrorResponse } from '../common/decorators/api-error-response.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { User } from '../users/entities/user.entity';
import { CreateReviewDto } from './dto/create-review.dto';
import {
  ReviewResponseDto,
  ReviewsResponseDto,
  toReviewResponse,
  toReviewsResponse,
} from './dto/review.dto';
import { ReviewsQueryDto } from './dto/reviews-query.dto';
import { ReviewsViewService } from './reviews-view.service';
import { ReviewsService } from './reviews.service';

@ApiTags('Reviews')
@ApiParam({ name: 'slug', example: 'ao-thun-cotton-basic' })
@Controller('products/:slug/reviews')
export class ProductReviewsController {
  constructor(
    private readonly reviewsService: ReviewsService,
    private readonly view: ReviewsViewService,
  ) {}

  @Get()
  @Public()
  @ApiOperation({
    summary: 'List the reviews of a product',
    description:
      'Newest first. `summary` covers every review of the product, ' +
      'whatever the `rating` filter. Reviewers are shown by username only.',
  })
  @ApiOkResponse({ type: ReviewsResponseDto })
  @ApiErrorResponse(HttpStatus.BAD_REQUEST, 'A query parameter is invalid.')
  @ApiErrorResponse(
    HttpStatus.NOT_FOUND,
    'No published or archived product has this slug.',
  )
  async list(
    @Param('slug') slug: string,
    @Query() query: ReviewsQueryDto,
  ): Promise<ReviewsResponseDto> {
    return toReviewsResponse(await this.view.list(slug, query));
  }

  @Post()
  @ApiBearerAuth(SWAGGER_BEARER_AUTH_NAME)
  @ApiOperation({
    summary: 'Review a product I received',
    description:
      'Only once per product, and only after one of my orders containing ' +
      'it has been delivered. The stars and the text go together.',
  })
  @ApiCreatedResponse({ type: ReviewResponseDto })
  @ApiErrorResponse(HttpStatus.BAD_REQUEST, 'The payload failed validation.')
  @ApiErrorResponse(
    HttpStatus.UNAUTHORIZED,
    'Missing, invalid or revoked token.',
  )
  @ApiErrorResponse(
    HttpStatus.FORBIDDEN,
    'No delivered order of mine contains this product, or my account is locked.',
  )
  @ApiErrorResponse(
    HttpStatus.NOT_FOUND,
    'No published or archived product has this slug.',
  )
  @ApiErrorResponse(
    HttpStatus.CONFLICT,
    'I have already reviewed this product.',
  )
  async create(
    @CurrentUser() user: User,
    @Param('slug') slug: string,
    @Body() dto: CreateReviewDto,
  ): Promise<ReviewResponseDto> {
    return toReviewResponse(
      await this.reviewsService.create(user, slug, dto.review),
    );
  }
}
