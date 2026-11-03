import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, LessThan, Repository } from 'typeorm';

import { MILLISECONDS_PER_DAY } from '../common/constants/time';
import { errorMessage } from '../common/helpers/error-message';
import { ORDERS_CONFIG_KEY, OrdersConfig } from '../config/orders.config';
import { MAIL_FALLBACK_LANGUAGE, MAIL_JOB } from '../mail/mail.constants';
import { MailQueueService } from '../mail/mail-queue.service';
import { User } from '../users/entities/user.entity';
import { Order } from './entities/order.entity';
import { OrderStatus } from './enums/order-status.enum';
import { PaymentStatus } from './enums/payment-status.enum';
import { OrderTransitionsService } from './order-transitions.service';
import { ORDER_AUTO_CANCEL_BATCH_SIZE } from './orders.constants';

@Injectable()
export class OrderExpiryService {
  private readonly logger = new Logger(OrderExpiryService.name);
  private readonly days: number;

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Order)
    private readonly ordersRepository: Repository<Order>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly transitions: OrderTransitionsService,
    private readonly mail: MailQueueService,
    configService: ConfigService,
  ) {
    this.days =
      configService.getOrThrow<OrdersConfig>(ORDERS_CONFIG_KEY).autoCancelDays;
  }

  findExpired(before: Date): Promise<Order[]> {
    return this.ordersRepository.find({
      where: {
        status: OrderStatus.Pending,
        paymentStatus: PaymentStatus.Unpaid,
        createdAt: LessThan(before),
      },
      order: { createdAt: 'ASC', id: 'ASC' },
      take: ORDER_AUTO_CANCEL_BATCH_SIZE,
    });
  }

  async cancelExpired(now: Date): Promise<number> {
    const expired = await this.findExpired(
      new Date(now.getTime() - this.days * MILLISECONDS_PER_DAY),
    );
    const customers = await this.customersOf(expired);
    let cancelled = 0;

    for (const { id } of expired) {
      try {
        const order = await this.cancel(id);

        if (order) {
          cancelled += 1;
          await this.notify(order, customers.get(order.userId));
        }
      } catch (error) {
        this.logger.error(
          `Could not cancel expired order ${id}: ${errorMessage(error)}`,
        );
      }
    }

    this.logger.log(
      `Cancelled ${cancelled} of ${expired.length} expired pending orders`,
    );

    return cancelled;
  }

  private cancel(id: string): Promise<Order | null> {
    return this.dataSource.transaction(async (manager) => {
      const order = await manager.findOne(Order, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!order || !isExpirable(order)) {
        return null;
      }

      return this.transitions.apply(manager, order, {
        to: OrderStatus.Cancelled,
        changedBy: null,
      });
    });
  }

  private async notify(
    order: Order,
    customer: User | undefined,
  ): Promise<void> {
    if (!customer) {
      return;
    }

    await this.mail.enqueue(MAIL_JOB.OrderAutoCancelled, {
      to: customer.email,
      fullName: customer.fullName,
      orderCode: order.code,
      days: this.days,
      lang: MAIL_FALLBACK_LANGUAGE,
    });
  }

  private async customersOf(orders: Order[]): Promise<Map<string, User>> {
    if (orders.length === 0) {
      return new Map();
    }

    const users = await this.usersRepository.find({
      where: { id: In([...new Set(orders.map(({ userId }) => userId))]) },
      select: { id: true, email: true, fullName: true },
      withDeleted: true,
    });

    return new Map(users.map((user) => [user.id, user]));
  }
}

function isExpirable({ status, paymentStatus }: Order): boolean {
  return (
    status === OrderStatus.Pending && paymentStatus === PaymentStatus.Unpaid
  );
}
