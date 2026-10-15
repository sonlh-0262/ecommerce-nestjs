import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';

import { SWAGGER_BEARER_AUTH_NAME } from '../common/constants/swagger';
import { ApiErrorResponse } from '../common/decorators/api-error-response.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ParseUuidPipe } from '../common/pipes/parse-uuid.pipe';
import { User } from '../users/entities/user.entity';
import { ReviewResponseDto, toReviewResponse } from './dto/review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { ReviewsService } from './reviews.service';

@ApiTags('Reviews')
@ApiBearerAuth(SWAGGER_BEARER_AUTH_NAME)
@ApiParam({ name: 'id', format: 'uuid' })
@ApiErrorResponse(HttpStatus.BAD_REQUEST, 'The id is not a uuid.')
@ApiErrorResponse(HttpStatus.UNAUTHORIZED, 'Missing, invalid or revoked token.')
@ApiErrorResponse(HttpStatus.FORBIDDEN, 'The account has been locked.')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Patch(':id')
  @ApiOperation({
    summary: 'Edit my review',
    description: 'Changing the stars recomputes the product average.',
  })
  @ApiOkResponse({ type: ReviewResponseDto })
  @ApiErrorResponse(
    HttpStatus.BAD_REQUEST,
    'The id is not a uuid, or the payload failed validation.',
  )
  @ApiErrorResponse(HttpStatus.NOT_FOUND, 'I have no review with this id.')
  async update(
    @CurrentUser() user: User,
    @Param('id', ParseUuidPipe) id: string,
    @Body() dto: UpdateReviewDto,
  ): Promise<ReviewResponseDto> {
    return toReviewResponse(
      await this.reviewsService.update(user, id, dto.review),
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a review',
    description:
      'My own review, or any review for an admin moderating content. The ' +
      'product average is recomputed.',
  })
  @ApiNoContentResponse({ description: 'The review is gone.' })
  @ApiErrorResponse(
    HttpStatus.NOT_FOUND,
    'No such review, or it is not mine and I am not an admin.',
  )
  remove(
    @CurrentUser() user: User,
    @Param('id', ParseUuidPipe) id: string,
  ): Promise<void> {
    return this.reviewsService.remove(user, id);
  }
}
