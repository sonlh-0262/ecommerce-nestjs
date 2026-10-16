import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { I18nService } from 'nestjs-i18n';
import { DataSource, EntityManager } from 'typeorm';

import { CartService } from '../cart/cart.service';
import { withDetails } from '../common/dto/error-response.dto';
import { ORDERS_CONFIG_KEY, OrdersConfig } from '../config/orders.config';
import { MAIL_JOB } from '../mail/mail.constants';
import { MailQueueService } from '../mail/mail-queue.service';
import { Product } from '../products/entities/product.entity';
import { canFulfil, isPurchasable } from '../products/product-purchase';
import { ProductsService } from '../products/products.service';
import { User } from '../users/entities/user.entity';
import { CancelOrderBodyDto } from './dto/cancel-order.dto';
import { CreateOrderBodyDto } from './dto/create-order.dto';
import { PayOrderBodyDto } from './dto/pay-order.dto';
import { OrderItem } from './entities/order-item.entity';
import { OrderStatusHistory } from './entities/order-status-history.entity';
import { Order } from './entities/order.entity';
import { OrderStatus } from './enums/order-status.enum';
import { PaymentMethod } from './enums/payment-method.enum';
import { PaymentStatus } from './enums/payment-status.enum';
import { OrderDetail } from './interfaces/order-detail.interface';
import { UnavailableItem } from './interfaces/unavailable-item.interface';
import { OrderCodeService } from './order-code.service';
import { OrderLine, PricedOrder, priceOrder } from './order-pricing';
import { canTransition } from './order-status.machine';
import { OrderTransitionsService } from './order-transitions.service';
import {
  ORDER_PAYABLE_STATUSES,
  UNAVAILABLE_ITEM_REASONS,
} from './orders.constants';
import { OrdersViewService } from './orders-view.service';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);
  private readonly shippingFee: number;

  constructor(
    private readonly dataSource: DataSource,
    private readonly cartService: CartService,
    private readonly productsService: ProductsService,
    private readonly orderCodes: OrderCodeService,
    private readonly transitions: OrderTransitionsService,
    private readonly view: OrdersViewService,
    private readonly mail: MailQueueService,
    private readonly i18n: I18nService,
    configService: ConfigService,
  ) {
    this.shippingFee =
      configService.getOrThrow<OrdersConfig>(ORDERS_CONFIG_KEY).shippingFee;
  }

  async checkout(user: User, input: CreateOrderBodyDto): Promise<OrderDetail> {
    const { order, priced } = await this.dataSource.transaction(
      async (manager) => {
        const cartItems = await this.cartService.lockItems(manager, user.id);

        if (cartItems.length === 0) {
          throw new UnprocessableEntityException(this.i18n.t('cart.EMPTY'));
        }

        const products = await this.productsService.lockForSale(
          manager,
          cartItems.map(({ productId }) => productId),
        );
        const productsById = new Map(products.map((p) => [p.id, p]));
        const lines = cartItems.map(({ productId, quantity }) => ({
          product: productsById.get(productId) as Product,
          quantity,
        }));

        this.assertAvailable(lines);

        const priced = priceOrder(lines, this.shippingFee);
        const order = await this.placeOrder(manager, user, input, priced);

        await this.cartService.removeItems(manager, cartItems);

        return { order, priced };
      },
    );

    await this.mail.enqueue(MAIL_JOB.OrderCreated, {
      to: user.email,
      fullName: user.fullName,
      orderCode: order.code,
      items: priced.lines.map(({ product, quantity, lineTotal }) => ({
        name: product.name,
        quantity,
        lineTotal,
      })),
      subtotal: order.subtotal,
      shippingFee: order.shippingFee,
      total: order.total,
      shippingAddress: order.shippingAddress,
    });
    this.logger.log(`User ${user.id} placed order ${order.code}`);

    return this.view.detailOf(order);
  }

  async pay(
    user: User,
    code: string,
    { transactionRef }: PayOrderBodyDto,
  ): Promise<OrderDetail> {
    const order = await this.dataSource.transaction(async (manager) => {
      const order = await this.lockOwned(manager, user.id, code);

      if (order.paymentMethod !== PaymentMethod.BankTransfer) {
        throw new UnprocessableEntityException(
          this.i18n.t('orders.PAYMENT_NOT_APPLICABLE'),
        );
      }

      if (order.paymentStatus === PaymentStatus.Paid) {
        throw new ConflictException(this.i18n.t('orders.ALREADY_PAID'));
      }

      if (!ORDER_PAYABLE_STATUSES.includes(order.status)) {
        throw new UnprocessableEntityException(
          this.i18n.t('orders.INVALID_STATE'),
        );
      }

      const patch = {
        paymentTransactionRef: transactionRef,
        paymentStatus: PaymentStatus.Paid,
        paidAt: new Date(),
      };

      await manager.update(Order, { id: order.id }, patch);

      return Object.assign(order, patch);
    });

    this.logger.log(`User ${user.id} declared a payment for ${order.code}`);

    return this.view.detailOf(order);
  }

  async cancel(
    user: User,
    code: string,
    input: CancelOrderBodyDto = {},
  ): Promise<OrderDetail> {
    const reason = input.reason ?? null;

    const order = await this.dataSource.transaction(async (manager) => {
      const order = await this.lockOwned(manager, user.id, code);

      if (!canTransition(order.status, OrderStatus.Cancelled)) {
        throw new UnprocessableEntityException(
          this.i18n.t('orders.CANNOT_CANCEL'),
        );
      }

      return this.transitions.apply(manager, order, {
        to: OrderStatus.Cancelled,
        reason,
        changedBy: user.id,
        patch: { reason },
      });
    });

    this.logger.log(`User ${user.id} cancelled order ${order.code}`);

    return this.view.detailOf(order);
  }

  private async placeOrder(
    manager: EntityManager,
    user: User,
    input: CreateOrderBodyDto,
    priced: PricedOrder,
  ): Promise<Order> {
    const code = await this.orderCodes.next(manager);
    const order = await manager.save(
      manager.create(Order, {
        ...input,
        code,
        userId: user.id,
        note: input.note ?? null,
        status: OrderStatus.Pending,
        paymentStatus: PaymentStatus.Unpaid,
        subtotal: priced.subtotal,
        shippingFee: priced.shippingFee,
        total: priced.total,
      }),
    );

    await manager.insert(
      OrderItem,
      priced.lines.map(({ product, quantity, unitPrice, lineTotal }) => ({
        orderId: order.id,
        productId: product.id,
        productName: product.name,
        productSlug: product.slug,
        unitPrice,
        quantity,
        lineTotal,
      })),
    );

    for (const { product, quantity } of priced.lines) {
      await this.productsService.recordSale(manager, product.id, quantity);
    }

    await manager.insert(OrderStatusHistory, {
      orderId: order.id,
      fromStatus: null,
      toStatus: order.status,
      changedBy: user.id,
    });

    return order;
  }

  private assertAvailable(lines: OrderLine[]): void {
    const unavailable = lines
      .filter(({ product, quantity }) => !canFulfil(product, quantity))
      .map(({ product }): UnavailableItem => {
        const onSale = isPurchasable(product);

        return {
          productId: product.id,
          name: product.name,
          reason: onSale
            ? UNAVAILABLE_ITEM_REASONS.OutOfStock
            : UNAVAILABLE_ITEM_REASONS.Unavailable,
          availableStock: onSale ? product.stock : 0,
        };
      });

    if (unavailable.length > 0) {
      throw new ConflictException(
        withDetails(this.i18n.t('orders.ITEMS_UNAVAILABLE'), {
          items: unavailable,
        }),
      );
    }
  }

  private async lockOwned(
    manager: EntityManager,
    userId: string,
    code: string,
  ): Promise<Order> {
    const order = await manager.findOne(Order, {
      where: { code, userId },
      lock: { mode: 'pessimistic_write' },
    });

    if (!order) {
      throw new NotFoundException(this.i18n.t('orders.NOT_FOUND'));
    }

    return order;
  }
}
