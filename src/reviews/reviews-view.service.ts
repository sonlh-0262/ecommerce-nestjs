import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { I18nService } from 'nestjs-i18n';
import { In, Repository } from 'typeorm';

import { Product } from '../products/entities/product.entity';
import { ProductsService } from '../products/products.service';
import { User } from '../users/entities/user.entity';
import { UserAvatarsService } from '../users/user-avatars.service';
import { ReviewsQueryDto } from './dto/reviews-query.dto';
import { Review } from './entities/review.entity';
import {
  ReviewAuthor,
  ReviewPage,
  ReviewView,
} from './interfaces/review-view.interface';
import {
  RATING_MAX,
  RATING_MIN,
  REVIEWABLE_PRODUCT_STATUSES,
} from './reviews.constants';

interface RatingCountRow {
  rating: number;
  count: string;
}

@Injectable()
export class ReviewsViewService {
  constructor(
    @InjectRepository(Review)
    private readonly reviewsRepository: Repository<Review>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly productsService: ProductsService,
    private readonly avatars: UserAvatarsService,
    private readonly i18n: I18nService,
  ) {}

  async findProduct(slug: string): Promise<Product> {
    const product = await this.productsService.findBySlug(slug);

    if (!product || !REVIEWABLE_PRODUCT_STATUSES.includes(product.status)) {
      throw new NotFoundException(this.i18n.t('products.NOT_FOUND'));
    }

    return product;
  }

  async list(slug: string, query: ReviewsQueryDto): Promise<ReviewPage> {
    const product = await this.findProduct(slug);

    const [[reviews, total], distribution] = await Promise.all([
      this.reviewsRepository.findAndCount({
        where: { productId: product.id, rating: query.rating },
        order: { createdAt: 'DESC', id: 'DESC' },
        skip: query.offset,
        take: query.limit,
      }),
      this.distribution(product.id),
    ]);
    const authors = await this.authorsOf(reviews.map(({ userId }) => userId));

    return {
      reviews: reviews.map((review) => ({
        review,
        author: authors.get(review.userId) as ReviewAuthor,
      })),
      total,
      summary: {
        average: product.averageRating,
        total: product.reviewCount,
        distribution,
      },
    };
  }

  async viewOf(review: Review, author: User): Promise<ReviewView> {
    return {
      review,
      author: {
        username: author.username,
        fullName: author.fullName,
        avatarUrl: await this.avatars.urlOf(author.id),
      },
    };
  }

  private async distribution(
    productId: string,
  ): Promise<Record<number, number>> {
    const rows = await this.reviewsRepository
      .createQueryBuilder('review')
      .select('review.rating', 'rating')
      .addSelect('COUNT(*)', 'count')
      .where('review.productId = :productId', { productId })
      .groupBy('review.rating')
      .getRawMany<RatingCountRow>();

    const counts = new Map(rows.map(({ rating, count }) => [rating, count]));

    return Object.fromEntries(
      Array.from({ length: RATING_MAX - RATING_MIN + 1 }, (_, index) => {
        const rating = RATING_MIN + index;

        return [rating, Number(counts.get(rating) ?? 0)];
      }),
    );
  }

  private async authorsOf(ids: string[]): Promise<Map<string, ReviewAuthor>> {
    if (ids.length === 0) {
      return new Map();
    }

    const [users, avatarUrls] = await Promise.all([
      this.usersRepository.find({
        where: { id: In([...new Set(ids)]) },
        select: { id: true, username: true, fullName: true },
        withDeleted: true,
      }),
      this.avatars.urlsOf(ids),
    ]);

    return new Map(
      users.map((user) => [
        user.id,
        {
          username: user.username,
          fullName: user.fullName,
          avatarUrl: avatarUrls.get(user.id) ?? null,
        },
      ]),
    );
  }
}
