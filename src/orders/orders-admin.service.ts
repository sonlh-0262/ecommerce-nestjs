import {
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { DataSource, EntityManager } from 'typeorm';

import { MAIL_FALLBACK_LANGUAGE, MAIL_JOB } from '../mail/mail.constants';
import { MailQueueService } from '../mail/mail-queue.service';
import { Shop } from '../shops/entities/shop.entity';
import { User } from '../users/entities/user.entity';
import { UserStatus } from '../users/enums/user-status.enum';
import { UpdateOrderStatusBodyDto } from './dto/update-order-status.dto';
import { Order } from './entities/order.entity';
import { OrderStatus } from './enums/order-status.enum';
import { PaymentMethod } from './enums/payment-method.enum';
import { PaymentStatus } from './enums/payment-status.enum';
import { AdminOrderDetail } from './interfaces/admin-order.interface';
import {
  canTransition,
  completesDelivery,
  notifiesCustomer,
  requiresReason,
} from './order-status.machine';
import { OrderTransitionsService } from './order-transitions.service';
import { REASON_MIN_LENGTH } from './orders.constants';
import { OrdersViewService } from './orders-view.service';

@Injectable()
export class OrdersAdminService {
  private readonly logger = new Logger(OrdersAdminService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly transitions: OrderTransitionsService,
    private readonly view: OrdersViewService,
    private readonly mail: MailQueueService,
    private readonly i18n: I18nService,
  ) {}

  async changeStatus(
    actor: User,
    code: string,
    { status, reason = null }: UpdateOrderStatusBodyDto,
    shopId?: string,
  ): Promise<AdminOrderDetail> {
    const order = await this.dataSource.transaction(async (manager) => {
      const order = await this.lockByCode(manager, code, shopId);

      if (!canTransition(order.status, status)) {
        throw new UnprocessableEntityException(
          this.i18n.t('orders.INVALID_TRANSITION', {
            args: { from: order.status, to: status },
          }),
        );
      }

      if (awaitsCardPayment(order, status)) {
        throw new UnprocessableEntityException(
          this.i18n.t('orders.AWAITING_PAYMENT'),
        );
      }

      if (requiresReason(status) && !reason) {
        throw new UnprocessableEntityException(
          this.i18n.t('orders.REASON_REQUIRED', {
            args: { min: REASON_MIN_LENGTH },
          }),
        );
      }

      return this.transitions.apply(manager, order, {
        to: status,
        reason,
        changedBy: actor.id,
        patch: this.patchFor(order, status, reason),
      });
    });

    const detail = await this.view.adminDetailOf(order);

    if (notifiesCustomer(status)) {
      await this.mail.enqueue(MAIL_JOB.OrderStatusChanged, {
        to: detail.customer.email,
        fullName: detail.customer.fullName,
        orderCode: order.code,
        status,
        reason: order.reason,
        lang: MAIL_FALLBACK_LANGUAGE,
      });
    }

    this.logger.log(`User ${actor.id} moved order ${order.code} to ${status}`);

    return detail;
  }

  private patchFor(
    order: Order,
    status: OrderStatus,
    reason: string | null,
  ): Partial<Order> {
    const patch: Partial<Order> = requiresReason(status) ? { reason } : {};

    if (completesDelivery(status)) {
      const now = new Date();

      patch.deliveredAt = now;

      if (
        order.paymentMethod === PaymentMethod.Cod &&
        order.paymentStatus === PaymentStatus.Unpaid
      ) {
        patch.paymentStatus = PaymentStatus.Paid;
        patch.paidAt = now;
      }
    }

    return patch;
  }

  private async lockByCode(
    manager: EntityManager,
    code: string,
    shopId?: string,
  ): Promise<Order> {
    const order = await manager.findOne(Order, {
      where: shopId === undefined ? { code } : { code, shopId },
      lock: { mode: 'pessimistic_write' },
    });

    if (!order) {
      throw new NotFoundException(this.i18n.t('orders.NOT_FOUND'));
    }

    if (
      shopId === undefined &&
      order.shopId &&
      (await this.isRunByItsOwner(manager, order.shopId))
    ) {
      throw new UnprocessableEntityException(
        this.i18n.t('orders.MANAGED_BY_SHOP'),
      );
    }

    return order;
  }

  private isRunByItsOwner(
    manager: EntityManager,
    shopId: string,
  ): Promise<boolean> {
    return manager.exists(Shop, {
      where: { id: shopId, owner: { status: UserStatus.Active } },
    });
  }
}

function awaitsCardPayment(order: Order, to: OrderStatus): boolean {
  return (
    to === OrderStatus.Confirmed &&
    order.paymentMethod === PaymentMethod.Card &&
    order.paymentStatus !== PaymentStatus.Paid
  );
}
