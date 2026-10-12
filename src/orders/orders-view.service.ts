import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { I18nService } from 'nestjs-i18n';
import { FindOptionsOrder, In, Repository } from 'typeorm';

import { ProductThumbnailsService } from '../products/product-thumbnails.service';
import { OrdersQueryDto } from './dto/orders-query.dto';
import { OrderItem } from './entities/order-item.entity';
import { OrderStatusHistory } from './entities/order-status-history.entity';
import { Order } from './entities/order.entity';
import { OrderDetail } from './interfaces/order-detail.interface';
import { OrderPage } from './interfaces/order-summary.interface';

const ITEMS_ORDER: FindOptionsOrder<OrderItem> = {
  productName: 'ASC',
  id: 'ASC',
};

@Injectable()
export class OrdersViewService {
  constructor(
    @InjectRepository(Order)
    private readonly ordersRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly itemsRepository: Repository<OrderItem>,
    @InjectRepository(OrderStatusHistory)
    private readonly historyRepository: Repository<OrderStatusHistory>,
    private readonly thumbnails: ProductThumbnailsService,
    private readonly i18n: I18nService,
  ) {}

  async list(userId: string, query: OrdersQueryDto): Promise<OrderPage> {
    const builder = this.ordersRepository
      .createQueryBuilder('order')
      .where('order.userId = :userId', { userId });

    if (query.status) {
      builder.andWhere('order.status = :status', { status: query.status });
    }

    if (query.from) {
      builder.andWhere('order.createdAt >= :from', {
        from: new Date(query.from),
      });
    }

    if (query.to) {
      builder.andWhere('order.createdAt <= :to', { to: new Date(query.to) });
    }

    const [orders, total] = await builder
      .orderBy('order.createdAt', 'DESC')
      .addOrderBy('order.id', 'DESC')
      .offset(query.offset)
      .limit(query.limit)
      .getManyAndCount();

    const itemsByOrder = await this.itemsByOrder(orders);
    const summaries = orders.map((order) => {
      const items = itemsByOrder.get(order.id) ?? [];

      return { order, itemsCount: items.length, firstItem: items[0] ?? null };
    });
    const thumbnailUrls = await this.thumbnails.urlsOf(
      summaries.flatMap(({ firstItem }) =>
        firstItem ? [firstItem.productId] : [],
      ),
    );

    return {
      summaries: summaries.map((summary) => ({
        ...summary,
        thumbnailUrl: summary.firstItem
          ? (thumbnailUrls.get(summary.firstItem.productId) ?? null)
          : null,
      })),
      total,
    };
  }

  async findOwned(userId: string, code: string): Promise<OrderDetail> {
    const order = await this.ordersRepository.findOneBy({ code, userId });

    if (!order) {
      throw new NotFoundException(this.i18n.t('orders.NOT_FOUND'));
    }

    return this.detailOf(order);
  }

  async detailOf(order: Order): Promise<OrderDetail> {
    const [items, history] = await Promise.all([
      this.itemsRepository.find({
        where: { orderId: order.id },
        order: ITEMS_ORDER,
      }),
      this.historyRepository.find({
        where: { orderId: order.id },
        order: { createdAt: 'ASC', id: 'ASC' },
      }),
    ]);
    const thumbnailUrls = await this.thumbnails.urlsOf(
      items.map(({ productId }) => productId),
    );

    return { order, items, history, thumbnailUrls };
  }

  private async itemsByOrder(
    orders: Order[],
  ): Promise<Map<string, OrderItem[]>> {
    const grouped = new Map<string, OrderItem[]>();

    if (orders.length === 0) {
      return grouped;
    }

    const items = await this.itemsRepository.find({
      where: { orderId: In(orders.map(({ id }) => id)) },
      order: ITEMS_ORDER,
    });

    for (const item of items) {
      const group = grouped.get(item.orderId);

      if (group) {
        group.push(item);
      } else {
        grouped.set(item.orderId, [item]);
      }
    }

    return grouped;
  }
}
