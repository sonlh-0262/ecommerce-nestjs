import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { DataSource, EntityManager, FindOptionsWhere } from 'typeorm';

import { definedFields } from '../common/helpers/defined-fields';
import { uniqueViolationConstraint } from '../database/unique-violation';
import { OrderItem } from '../orders/entities/order-item.entity';
import { Order } from '../orders/entities/order.entity';
import { OrderStatus } from '../orders/enums/order-status.enum';
import { ProductsService } from '../products/products.service';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/enums/user-role.enum';
import { CreateReviewBodyDto } from './dto/create-review.dto';
import { UpdateReviewBodyDto } from './dto/update-review.dto';
import { Review } from './entities/review.entity';
import { ReviewView } from './interfaces/review-view.interface';
import { UNIQUE_REVIEWS_PRODUCT_USER_INDEX } from './reviews.constants';
import { ReviewsViewService } from './reviews-view.service';

@Injectable()
export class ReviewsService {
  private readonly logger = new Logger(ReviewsService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly productsService: ProductsService,
    private readonly view: ReviewsViewService,
    private readonly i18n: I18nService,
  ) {}

  async create(
    user: User,
    slug: string,
    input: CreateReviewBodyDto,
  ): Promise<ReviewView> {
    const product = await this.view.findProduct(slug);

    const review = await this.dataSource
      .transaction(async (manager) => {
        const orderId = await this.deliveredOrderId(
          manager,
          user.id,
          product.id,
        );

        if (!orderId) {
          throw new ForbiddenException(this.i18n.t('reviews.NOT_PURCHASED'));
        }

        const review = await manager.save(
          manager.create(Review, {
            ...input,
            productId: product.id,
            userId: user.id,
            orderId,
          }),
        );

        await this.productsService.refreshRating(manager, product.id);

        return review;
      })
      .catch((error: unknown) => {
        if (
          uniqueViolationConstraint(error) === UNIQUE_REVIEWS_PRODUCT_USER_INDEX
        ) {
          throw new ConflictException(this.i18n.t('reviews.ALREADY_REVIEWED'));
        }

        throw error;
      });

    this.logger.log(`User ${user.id} reviewed product ${product.id}`);

    return this.view.viewOf(review, user);
  }

  async update(
    user: User,
    id: string,
    input: UpdateReviewBodyDto,
  ): Promise<ReviewView> {
    const patch = definedFields(input);

    const review = await this.dataSource.transaction(async (manager) => {
      const review = await this.lock(manager, { id, userId: user.id });

      await manager.update(Review, { id }, patch);

      if (patch.rating !== undefined && patch.rating !== review.rating) {
        await this.productsService.refreshRating(manager, review.productId);
      }

      return manager.findOneByOrFail(Review, { id });
    });

    this.logger.log(`User ${user.id} edited review ${id}`);

    return this.view.viewOf(review, user);
  }

  async remove(user: User, id: string): Promise<void> {
    const where =
      user.role === UserRole.Admin ? { id } : { id, userId: user.id };

    await this.dataSource.transaction(async (manager) => {
      const review = await this.lock(manager, where);

      await manager.delete(Review, { id });
      await this.productsService.refreshRating(manager, review.productId);
    });

    this.logger.log(`User ${user.id} deleted review ${id}`);
  }

  private async lock(
    manager: EntityManager,
    where: FindOptionsWhere<Review>,
  ): Promise<Review> {
    const review = await manager.findOne(Review, {
      where,
      lock: { mode: 'pessimistic_write' },
    });

    if (!review) {
      throw new NotFoundException(this.i18n.t('reviews.NOT_FOUND'));
    }

    return review;
  }

  private async deliveredOrderId(
    manager: EntityManager,
    userId: string,
    productId: string,
  ): Promise<string | null> {
    const row = await manager
      .createQueryBuilder(Order, 'order')
      .select('order.id', 'id')
      .innerJoin(OrderItem, 'item', 'item.orderId = order.id')
      .where('order.userId = :userId', { userId })
      .andWhere('item.productId = :productId', { productId })
      .andWhere('order.status = :delivered', {
        delivered: OrderStatus.Delivered,
      })
      .orderBy('order.deliveredAt', 'DESC')
      .limit(1)
      .getRawOne<{ id: string }>();

    return row?.id ?? null;
  }
}
