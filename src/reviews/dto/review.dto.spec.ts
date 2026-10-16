import { Review } from '../entities/review.entity';
import { toReviewResponse, toReviewsResponse } from './review.dto';

describe('review mappers', () => {
  const CREATED_AT = new Date('2026-10-10T08:30:00.000Z');
  const UPDATED_AT = new Date('2026-10-11T08:30:00.000Z');

  const view = {
    review: {
      id: 'r1',
      rating: 5,
      content: 'Vải mát, mặc vừa người.',
      userId: 'u1',
      orderId: 'o1',
      createdAt: CREATED_AT,
      updatedAt: UPDATED_AT,
    } as Review,
    author: { username: 'son', fullName: 'Son', avatarUrl: null },
  };

  const dto = {
    id: 'r1',
    rating: 5,
    content: 'Vải mát, mặc vừa người.',
    user: { username: 'son', fullName: 'Son', avatarUrl: null },
    createdAt: CREATED_AT.toISOString(),
    updatedAt: UPDATED_AT.toISOString(),
  };

  it('shows the review and its author, never the ids behind them', () => {
    expect(toReviewResponse(view)).toEqual({ review: dto });
  });

  it('pages the reviews with the summary of the whole product', () => {
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 1, 5: 1 };

    expect(
      toReviewsResponse({
        reviews: [view],
        total: 7,
        summary: { average: 4.5, total: 2, distribution },
      }),
    ).toEqual({
      reviews: [dto],
      reviewsCount: 7,
      summary: { average: 4.5, total: 2, distribution },
    });
  });
});
