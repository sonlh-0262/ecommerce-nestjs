import { Injectable, Logger } from '@nestjs/common';
import { DataSource, In } from 'typeorm';

import { CartService } from '../../cart/cart.service';
import {
  DEMO_ADMIN_STEPS,
  DEMO_ORDERS,
  DEMO_REVIEW_COMMENTS,
} from '../../database/seeds/demo.seed-data';
import { SeedDemoOrder } from '../../database/seeds/interfaces/seed-demo-order.interface';
import { SeededRandom } from '../../database/seeds/seeded-random';
import {
  DEMO_CANCEL_REASON,
  DEMO_DELIVERY_MAX_DAY_OFFSET,
  DEMO_DELIVERY_SPREAD_MONTHS,
  DEMO_MAX_QUANTITY,
  DEMO_RANDOM_SEED,
  DEMO_RECEIVER_PHONE,
  DEMO_REJECT_REASON,
  DEMO_SHIPPING_ADDRESS,
  DEMO_TRANSACTION_REF_PREFIX,
} from '../../database/seeds/seed.constants';
import { OrderStatusHistory } from '../../orders/entities/order-status-history.entity';
import { Order } from '../../orders/entities/order.entity';
import { OrderStatus } from '../../orders/enums/order-status.enum';
import { requiresReason } from '../../orders/order-status.machine';
import { OrdersAdminService } from '../../orders/orders-admin.service';
import { OrdersService } from '../../orders/orders.service';
import { Product } from '../../products/entities/product.entity';
import { RATING_MAX, RATING_MIN } from '../../reviews/reviews.constants';
import { ReviewsService } from '../../reviews/reviews.service';
import { User } from '../../users/entities/user.entity';

interface DeliveredOrder {
  buyer: User;
  orderId: string;
  deliveredAt: Date;
  products: Product[];
}

const SHIFT_PARAMETER = 'shift';

const shiftedBy = (column: string) => () =>
  `${column} - CAST(:${SHIFT_PARAMETER} AS interval)`;

@Injectable()
export class DemoOrdersSeeder {
  private readonly logger = new Logger(DemoOrdersSeeder.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly cartService: CartService,
    private readonly ordersService: OrdersService,
    private readonly ordersAdmin: OrdersAdminService,
    private readonly reviewsService: ReviewsService,
  ) {}

  async seed(admin: User, buyers: User[], products: Product[]): Promise<void> {
    if (buyers.length === 0) {
      throw new Error('No active demo user to place the demo orders with.');
    }

    const existing = await this.existingOrders(buyers);

    if (existing >= DEMO_ORDERS.length) {
      this.logger.log('Demo orders already exist, left unchanged');

      return;
    }

    if (existing > 0) {
      throw new Error(
        `Found ${existing} of ${DEMO_ORDERS.length} demo orders from an ` +
          'interrupted run: rerun with --fresh.',
      );
    }

    const random = new SeededRandom(DEMO_RANDOM_SEED);
    const shelves = buyers.map(() => random.shuffle(products));
    const delivered: DeliveredOrder[] = [];

    for (const [index, plan] of DEMO_ORDERS.entries()) {
      const buyer = buyers[index % buyers.length];
      const lines = shelves[index % buyers.length].splice(0, plan.lines);

      if (lines.length < plan.lines) {
        throw new Error(
          `Not enough purchasable products for demo order ${index + 1}.`,
        );
      }

      const placed = await this.place(buyer, lines, plan, random);
      const order = await this.advance(admin, buyer, placed, plan, index);

      if (order.deliveredAt) {
        delivered.push({
          buyer,
          orderId: order.id,
          deliveredAt: order.deliveredAt,
          products: lines,
        });
      }
    }

    await this.backdate(delivered, random);
    const reviews = await this.review(delivered, random);

    this.logger.log(
      `Created ${DEMO_ORDERS.length} demo orders and ${reviews} reviews`,
    );
  }

  private existingOrders(buyers: User[]): Promise<number> {
    return this.dataSource
      .getRepository(Order)
      .countBy({ userId: In(buyers.map(({ id }) => id)) });
  }

  private async place(
    buyer: User,
    products: Product[],
    plan: SeedDemoOrder,
    random: SeededRandom,
  ): Promise<Order> {
    await this.cartService.clear(buyer.id);

    for (const product of products) {
      await this.cartService.addItem(buyer.id, {
        productId: product.id,
        quantity: random.int(1, DEMO_MAX_QUANTITY),
      });
    }

    const { order } = await this.ordersService.checkout(buyer, {
      receiverName: buyer.fullName ?? buyer.username,
      receiverPhone: DEMO_RECEIVER_PHONE,
      shippingAddress: DEMO_SHIPPING_ADDRESS,
      paymentMethod: plan.paymentMethod,
    });

    return order;
  }

  private async advance(
    admin: User,
    buyer: User,
    placed: Order,
    plan: SeedDemoOrder,
    index: number,
  ): Promise<Order> {
    const { code } = placed;
    let order = placed;

    if (plan.paid) {
      ({ order } = await this.ordersService.pay(buyer, code, {
        transactionRef: `${DEMO_TRANSACTION_REF_PREFIX}${index + 1}`,
      }));
    }

    if (plan.status === OrderStatus.Cancelled) {
      ({ order } = await this.ordersService.cancel(buyer, code, {
        reason: DEMO_CANCEL_REASON,
      }));
    }

    for (const status of DEMO_ADMIN_STEPS[plan.status]) {
      ({ order } = await this.ordersAdmin.changeStatus(admin, code, {
        status,
        reason: requiresReason(status) ? DEMO_REJECT_REASON : null,
      }));
    }

    return order;
  }

  private async backdate(
    delivered: DeliveredOrder[],
    random: SeededRandom,
  ): Promise<void> {
    const now = new Date();

    for (const [index, { orderId, deliveredAt }] of delivered.entries()) {
      const target = deliveryDate(now, index, delivered.length, random);
      const shift = `${deliveredAt.getTime() - target.getTime()} milliseconds`;

      await this.dataSource.transaction(async (manager) => {
        await manager
          .createQueryBuilder()
          .update(Order)
          .set({
            createdAt: shiftedBy('created_at'),
            updatedAt: shiftedBy('updated_at'),
            deliveredAt: shiftedBy('delivered_at'),
            paidAt: shiftedBy('paid_at'),
          })
          .where({ id: orderId })
          .setParameter(SHIFT_PARAMETER, shift)
          .execute();
        await manager
          .createQueryBuilder()
          .update(OrderStatusHistory)
          .set({ createdAt: shiftedBy('created_at') })
          .where({ orderId })
          .setParameter(SHIFT_PARAMETER, shift)
          .execute();
      });
    }
  }

  private async review(
    delivered: DeliveredOrder[],
    random: SeededRandom,
  ): Promise<number> {
    let created = 0;

    for (const { buyer, products } of delivered) {
      for (const product of products) {
        const rating = random.int(RATING_MIN, RATING_MAX);

        await this.reviewsService.create(buyer, product.slug, {
          rating,
          content: random.pick(DEMO_REVIEW_COMMENTS[rating]),
        });
        created += 1;
      }
    }

    return created;
  }
}

function deliveryDate(
  now: Date,
  index: number,
  count: number,
  random: SeededRandom,
): Date {
  const monthsAgo = Math.round(
    (index * (DEMO_DELIVERY_SPREAD_MONTHS - 1)) / Math.max(count - 1, 1),
  );
  const date = new Date(now);

  date.setUTCMonth(date.getUTCMonth() - monthsAgo);
  date.setUTCDate(
    date.getUTCDate() - random.int(0, DEMO_DELIVERY_MAX_DAY_OFFSET),
  );

  return date;
}
