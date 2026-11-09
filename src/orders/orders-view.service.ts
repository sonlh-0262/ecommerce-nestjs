import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { I18nService } from 'nestjs-i18n';
import {
  FindOptionsOrder,
  FindOptionsWhere,
  In,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';

import { prefixPattern } from '../common/helpers/escape-like';
import { ProductThumbnailsService } from '../products/product-thumbnails.service';
import { ShopsViewService, shopIn } from '../shops/shops-view.service';
import { UserRef } from '../users/dto/user-ref.dto';
import { User } from '../users/entities/user.entity';
import { loadUserRefs } from '../users/user-refs';
import { AdminOrdersQueryDto } from './dto/admin-orders-query.dto';
import { OrdersQueryDto } from './dto/orders-query.dto';
import { OrderItem } from './entities/order-item.entity';
import { OrderStatusHistory } from './entities/order-status-history.entity';
import { Order } from './entities/order.entity';
import {
  AdminOrderDetail,
  AdminOrderPage,
} from './interfaces/admin-order.interface';
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
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly thumbnails: ProductThumbnailsService,
    private readonly shops: ShopsViewService,
    private readonly i18n: I18nService,
  ) {}

  list(userId: string, query: OrdersQueryDto): Promise<OrderPage> {
    return this.page(
      this.ordersRepository
        .createQueryBuilder('order')
        .where('order.userId = :userId', { userId }),
      query,
    );
  }

  adminList(query: AdminOrdersQueryDto): Promise<AdminOrderPage> {
    return this.managedPage(
      this.ordersRepository.createQueryBuilder('order'),
      query,
    );
  }

  shopList(
    shopId: string,
    query: AdminOrdersQueryDto,
  ): Promise<AdminOrderPage> {
    return this.managedPage(
      this.ordersRepository
        .createQueryBuilder('order')
        .where('order.shopId = :shopId', { shopId }),
      query,
    );
  }

  async findOwned(userId: string, code: string): Promise<OrderDetail> {
    return this.detailOf(await this.findOrFail({ code, userId }));
  }

  async adminFind(code: string): Promise<AdminOrderDetail> {
    return this.adminDetailOf(await this.findOrFail({ code }));
  }

  async shopFind(shopId: string, code: string): Promise<AdminOrderDetail> {
    return this.adminDetailOf(await this.findOrFail({ code, shopId }));
  }

  async detailOf(order: Order): Promise<OrderDetail> {
    const [items, history, shops] = await Promise.all([
      this.itemsRepository.find({
        where: { orderId: order.id },
        order: ITEMS_ORDER,
      }),
      this.historyRepository.find({
        where: { orderId: order.id },
        order: { createdAt: 'ASC', id: 'ASC' },
      }),
      this.shops.byIds([order.shopId]),
    ]);
    const thumbnailUrls = await this.thumbnails.urlsOf(
      items.map(({ productId }) => productId),
    );

    return {
      order,
      shop: shopIn(shops, order.shopId),
      items,
      history,
      thumbnailUrls,
    };
  }

  async adminDetailOf(order: Order): Promise<AdminOrderDetail> {
    const detail = await this.detailOf(order);
    const actors = await this.usersById([
      order.userId,
      ...detail.history.flatMap(({ changedBy }) =>
        changedBy ? [changedBy] : [],
      ),
    ]);

    return {
      ...detail,
      customer: actors.get(order.userId) as UserRef,
      actors,
    };
  }

  private async managedPage(
    builder: SelectQueryBuilder<Order>,
    query: AdminOrdersQueryDto,
  ): Promise<AdminOrderPage> {
    if (query.code) {
      builder.andWhere('order.code ILIKE :code', {
        code: prefixPattern(query.code),
      });
    }

    if (query.userId) {
      builder.andWhere('order.userId = :userId', { userId: query.userId });
    }

    const { summaries, total } = await this.page(builder, query);
    const users = await this.usersById(
      summaries.map(({ order }) => order.userId),
    );

    return {
      summaries: summaries.map((summary) => ({
        ...summary,
        customer: users.get(summary.order.userId) as UserRef,
      })),
      total,
    };
  }

  private async findOrFail(where: FindOptionsWhere<Order>): Promise<Order> {
    const order = await this.ordersRepository.findOneBy(where);

    if (!order) {
      throw new NotFoundException(this.i18n.t('orders.NOT_FOUND'));
    }

    return order;
  }

  private async page(
    builder: SelectQueryBuilder<Order>,
    query: OrdersQueryDto,
  ): Promise<OrderPage> {
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

    const [itemsByOrder, shops] = await Promise.all([
      this.itemsByOrder(orders),
      this.shops.byIds(orders.map(({ shopId }) => shopId)),
    ]);
    const summaries = orders.map((order) => {
      const items = itemsByOrder.get(order.id) ?? [];

      return {
        order,
        shop: shopIn(shops, order.shopId),
        itemsCount: items.length,
        firstItem: items[0] ?? null,
      };
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

  private usersById(ids: string[]): Promise<Map<string, UserRef>> {
    return loadUserRefs(this.usersRepository, ids);
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
