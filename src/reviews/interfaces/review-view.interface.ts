import { Review } from '../entities/review.entity';

export interface ReviewAuthor {
  username: string;
  fullName: string | null;
  avatarUrl: string | null;
}

export interface ReviewView {
  review: Review;
  author: ReviewAuthor;
}

export interface RatingSummary {
  average: number;
  total: number;
  distribution: Record<number, number>;
}

export interface ReviewPage {
  reviews: ReviewView[];
  total: number;
  summary: RatingSummary;
}
