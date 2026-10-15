import { ApiProperty } from '@nestjs/swagger';

import { paginated } from '../../common/helpers/paginated';
import {
  RatingSummary,
  ReviewPage,
  ReviewView,
} from '../interfaces/review-view.interface';

export class ReviewAuthorDto {
  @ApiProperty({ example: 'sonlh' })
  username: string;

  @ApiProperty({ nullable: true, example: 'Lanh Hung Son' })
  fullName: string | null;

  @ApiProperty({ nullable: true, example: null })
  avatarUrl: string | null;
}

export class ReviewDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 5 })
  rating: number;

  @ApiProperty({ example: 'Vải mát, mặc vừa người, giao hàng nhanh.' })
  content: string;

  @ApiProperty({ type: ReviewAuthorDto })
  user: ReviewAuthorDto;

  @ApiProperty({ example: '2026-10-10T08:30:00.000Z' })
  createdAt: string;

  @ApiProperty({ example: '2026-10-10T08:30:00.000Z' })
  updatedAt: string;
}

export class ReviewResponseDto {
  @ApiProperty({ type: ReviewDto })
  review: ReviewDto;
}

export class RatingSummaryDto {
  @ApiProperty({ description: 'Average over every review.', example: 4.35 })
  average: number;

  @ApiProperty({ description: 'Every review of the product.', example: 42 })
  total: number;

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'integer' },
    description: 'How many reviews gave each number of stars.',
    example: { 1: 1, 2: 0, 3: 5, 4: 12, 5: 24 },
  })
  distribution: Record<number, number>;
}

export class ReviewsResponseDto {
  @ApiProperty({ type: [ReviewDto], description: 'Newest first.' })
  reviews: ReviewDto[];

  @ApiProperty({
    description: 'Reviews matching the filter, across every page.',
    example: 42,
  })
  reviewsCount: number;

  @ApiProperty({
    type: RatingSummaryDto,
    description: 'Over every review of the product, whatever the filter.',
  })
  summary: RatingSummaryDto;
}

function toReviewDto({ review, author }: ReviewView): ReviewDto {
  return {
    id: review.id,
    rating: review.rating,
    content: review.content,
    user: {
      username: author.username,
      fullName: author.fullName,
      avatarUrl: author.avatarUrl,
    },
    createdAt: review.createdAt.toISOString(),
    updatedAt: review.updatedAt.toISOString(),
  };
}

export function toReviewResponse(view: ReviewView): ReviewResponseDto {
  return { review: toReviewDto(view) };
}

function toRatingSummaryDto(summary: RatingSummary): RatingSummaryDto {
  return {
    average: summary.average,
    total: summary.total,
    distribution: { ...summary.distribution },
  };
}

export function toReviewsResponse(page: ReviewPage): ReviewsResponseDto {
  return {
    ...paginated('reviews', page.reviews.map(toReviewDto), page.total),
    summary: toRatingSummaryDto(page.summary),
  };
}
