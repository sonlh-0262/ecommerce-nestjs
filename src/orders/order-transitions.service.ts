import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';

import { ProductsService } from '../products/products.service';
import { OrderItem } from './entities/order-item.entity';
import { OrderStatusHistory } from './entities/order-status-history.entity';
import { Order } from './entities/order.entity';
import { OrderStatusChange } from './interfaces/order-status-change.interface';
import { restoresStock } from './order-status.machine';

@Injectable()
export class OrderTransitionsService {
  constructor(private readonly productsService: ProductsService) {}

  async apply(
    manager: EntityManager,
    order: Order,
    { to, changedBy, reason = null, patch = {} }: OrderStatusChange,
  ): Promise<Order> {
    if (restoresStock(to)) {
      await this.restock(manager, order.id);
    }

    const changes = { ...patch, status: to };

    await manager.update(Order, { id: order.id }, changes);
    await manager.insert(OrderStatusHistory, {
      orderId: order.id,
      fromStatus: order.status,
      toStatus: to,
      reason,
      changedBy,
    });

    return Object.assign(order, changes);
  }

  private async restock(
    manager: EntityManager,
    orderId: string,
  ): Promise<void> {
    const items = await manager.find(OrderItem, {
      where: { orderId },
      order: { productId: 'ASC' },
    });

    for (const item of items) {
      await this.productsService.restock(
        manager,
        item.productId,
        item.quantity,
      );
    }
  }
}
