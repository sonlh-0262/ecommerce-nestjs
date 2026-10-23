import { DeepPartial, Repository } from 'typeorm';

import { DEFAULT_SHIPPING_FEE as SHIPPING_FEE } from '../../../src/config/config.constants';
import { OrderItem } from '../../../src/orders/entities/order-item.entity';
import { Order } from '../../../src/orders/entities/order.entity';
import { OrderStatus } from '../../../src/orders/enums/order-status.enum';
import { PaymentMethod } from '../../../src/orders/enums/payment-method.enum';
import { Product } from '../../../src/products/entities/product.entity';
import { Review } from '../../../src/reviews/entities/review.entity';
import { User } from '../../../src/users/entities/user.entity';
import { TEST_RECEIVER } from '../test.constants';
import { nextSequence } from './sequence';

export class OrderFactory {
  constructor(
    private readonly orders: Repository<Order>,
    private readonly items: Repository<OrderItem>,
    private readonly reviews: Repository<Review>,
  ) {}

  async order(
    buyer: User,
    product: Product,
    {
      quantity = 1,
      ...overrides
    }: DeepPartial<Order> & { quantity?: number } = {},
  ): Promise<Order> {
    const subtotal = product.price * quantity;
    const order = await this.orders.save(
      this.orders.create({
        code: `ORD-TEST-${nextSequence()}`,
        userId: buyer.id,
        status: OrderStatus.Pending,
        paymentMethod: PaymentMethod.Cod,
        ...TEST_RECEIVER,
        subtotal,
        shippingFee: SHIPPING_FEE,
        total: subtotal + SHIPPING_FEE,
        ...overrides,
      }),
    );

    await this.items.insert({
      orderId: order.id,
      productId: product.id,
      productName: product.name,
      productSlug: product.slug,
      unitPrice: product.price,
      quantity,
      lineTotal: subtotal,
    });

    return order;
  }

  review(author: User, product: Product): Promise<Review> {
    return this.reviews.save(
      this.reviews.create({
        userId: author.id,
        productId: product.id,
        rating: 5,
        content: 'A review written by the factory.',
      }),
    );
  }
}
