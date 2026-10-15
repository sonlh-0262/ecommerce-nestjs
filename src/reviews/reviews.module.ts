import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ProductsModule } from '../products/products.module';
import { User } from '../users/entities/user.entity';
import { UsersModule } from '../users/users.module';
import { Review } from './entities/review.entity';
import { ProductReviewsController } from './product-reviews.controller';
import { ReviewsViewService } from './reviews-view.service';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Review, User]),
    ProductsModule,
    UsersModule,
  ],
  controllers: [ProductReviewsController, ReviewsController],
  providers: [ReviewsService, ReviewsViewService],
})
export class ReviewsModule {}
