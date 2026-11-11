import {
  BadGatewayException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { I18nService } from 'nestjs-i18n';
import { DataSource, EntityManager, In, Repository } from 'typeorm';

import { errorMessage } from '../common/helpers/error-message';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { Order } from '../orders/entities/order.entity';
import { PaymentMethod } from '../orders/enums/payment-method.enum';
import { PaymentStatus } from '../orders/enums/payment-status.enum';
import { findOwnedOrderForUpdate } from '../orders/order-locks';
import { ORDER_PAYABLE_STATUSES } from '../orders/orders.constants';
import { User } from '../users/entities/user.entity';
import { Payment } from './entities/payment.entity';
import { PaymentAttemptStatus } from './enums/payment-attempt-status.enum';
import {
  GatewayIntent,
  PaymentGateway,
} from './interfaces/payment-gateway.interface';
import { PaymentPage } from './interfaces/payment-page.interface';
import {
  OPEN_PAYMENT_STATUSES,
  PAYMENT_CURRENCY,
  PAYMENT_GATEWAY,
} from './payments.constants';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Order)
    private readonly ordersRepository: Repository<Order>,
    @InjectRepository(Payment)
    private readonly paymentsRepository: Repository<Payment>,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway,
    private readonly i18n: I18nService,
  ) {}

  start(user: User, code: string): Promise<Payment> {
    return this.dataSource.transaction(async (manager) => {
      const order = await findOwnedOrderForUpdate(manager, user.id, code);

      if (!order) {
        throw new NotFoundException(this.i18n.t('orders.NOT_FOUND'));
      }

      this.assertPayable(order);

      const open = await manager.findOne(Payment, {
        where: { orderId: order.id, status: In(OPEN_PAYMENT_STATUSES) },
      });

      return open ?? this.open(manager, order);
    });
  }

  async list(
    user: User,
    code: string,
    { limit, offset }: PaginationQueryDto,
  ): Promise<PaymentPage> {
    const order = await this.ordersRepository.findOne({
      where: { code, userId: user.id },
      select: { id: true },
    });

    if (!order) {
      throw new NotFoundException(this.i18n.t('orders.NOT_FOUND'));
    }

    const [payments, total] = await this.paymentsRepository.findAndCount({
      where: { orderId: order.id },
      order: { createdAt: 'DESC', id: 'DESC' },
      take: limit,
      skip: offset,
    });

    return { payments, total };
  }

  private assertPayable(order: Order): void {
    if (order.paymentMethod !== PaymentMethod.Card) {
      throw new UnprocessableEntityException(this.i18n.t('payments.CARD_ONLY'));
    }

    if (order.paymentStatus !== PaymentStatus.Unpaid) {
      throw new ConflictException(this.i18n.t('orders.ALREADY_PAID'));
    }

    if (!ORDER_PAYABLE_STATUSES.includes(order.status)) {
      throw new UnprocessableEntityException(
        this.i18n.t('orders.INVALID_STATE'),
      );
    }
  }

  private async open(manager: EntityManager, order: Order): Promise<Payment> {
    const id = randomUUID();
    const intent = await this.createIntent(id, order);
    const payment = await manager.save(
      manager.create(Payment, {
        id,
        orderId: order.id,
        provider: this.gateway.provider,
        providerPaymentId: intent.providerPaymentId,
        clientSecret: intent.clientSecret,
        status: PaymentAttemptStatus.Pending,
        amount: order.total,
        currency: PAYMENT_CURRENCY,
      }),
    );

    this.logger.log(`Opened payment ${payment.id} for ${order.code}`);

    return payment;
  }

  private async createIntent(
    paymentId: string,
    order: Order,
  ): Promise<GatewayIntent> {
    try {
      return await this.gateway.createIntent({
        paymentId,
        orderCode: order.code,
        amount: order.total,
        currency: PAYMENT_CURRENCY,
      });
    } catch (error) {
      this.logger.error(
        `${this.gateway.provider} refused an intent for ${order.code}: ${errorMessage(error)}`,
      );

      throw new BadGatewayException(
        this.i18n.t('payments.GATEWAY_UNAVAILABLE'),
      );
    }
  }
}
