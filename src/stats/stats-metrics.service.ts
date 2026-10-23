import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, SelectQueryBuilder } from 'typeorm';

import { OrderItem } from '../orders/entities/order-item.entity';
import { Order } from '../orders/entities/order.entity';
import { OrderStatus } from '../orders/enums/order-status.enum';
import { Product } from '../products/entities/product.entity';
import { ProductThumbnailsService } from '../products/product-thumbnails.service';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/enums/user-role.enum';
import { DateRange, RevenueWindow } from './interfaces/stats-period.interface';
import {
  Audience,
  BestSellerPage,
  DeliveredTotals,
  RevenuePoint,
} from './interfaces/stats.interface';
import { DELIVERED_ORDER_CONDITION } from './stats.constants';

interface TotalsRow {
  orders: string;
  revenue: string;
}

interface StatusCountRow {
  status: OrderStatus;
  count: string;
}

interface AudienceRow {
  totalProducts: string;
  totalUsers: string;
  newUsers: string;
}

interface BestSellerRow {
  id: string;
  name: string;
  slug: string;
  deletedAt: Date | null;
  soldQuantity: string;
  revenue: string;
  total: string;
}

interface RevenueRow {
  period: string;
  orders: string;
  revenue: string;
}

const DELIVERED_IN_RANGE =
  'order.deliveredAt >= :from AND order.deliveredAt < :to';

@Injectable()
export class StatsMetricsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(Order)
    private readonly ordersRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly itemsRepository: Repository<OrderItem>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly thumbnails: ProductThumbnailsService,
  ) {}

  async deliveredTotals(range: DateRange): Promise<DeliveredTotals> {
    const row = await delivered(
      this.ordersRepository.createQueryBuilder('order'),
      range,
    )
      .select('COUNT(*)', 'orders')
      .addSelect('COALESCE(SUM(order.total), 0)', 'revenue')
      .getRawOne<TotalsRow>();

    return {
      orders: Number(row?.orders ?? 0),
      revenue: Number(row?.revenue ?? 0),
    };
  }

  async ordersByStatus(range: DateRange): Promise<Record<OrderStatus, number>> {
    const rows = await this.ordersRepository
      .createQueryBuilder('order')
      .select('order.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('order.createdAt >= :from AND order.createdAt < :to', range)
      .groupBy('order.status')
      .getRawMany<StatusCountRow>();
    const counts = new Map(rows.map(({ status, count }) => [status, count]));

    return Object.fromEntries(
      Object.values(OrderStatus).map((status) => [
        status,
        Number(counts.get(status) ?? 0),
      ]),
    ) as Record<OrderStatus, number>;
  }

  async audience(range: DateRange): Promise<Audience> {
    const row = await this.usersRepository
      .createQueryBuilder('user')
      .select('COUNT(*)', 'totalUsers')
      .addSelect(
        'COUNT(*) FILTER (WHERE user.createdAt >= :from AND user.createdAt < :to)',
        'newUsers',
      )
      .addSelect(
        (products) => products.select('COUNT(*)').from(Product, 'product'),
        'totalProducts',
      )
      .where('user.role = :role', { role: UserRole.User })
      .setParameters(range)
      .getRawOne<AudienceRow>();

    return {
      totalProducts: Number(row?.totalProducts ?? 0),
      totalUsers: Number(row?.totalUsers ?? 0),
      newUsers: Number(row?.newUsers ?? 0),
    };
  }

  async bestSellers(range: DateRange, limit: number): Promise<BestSellerPage> {
    const rows = await delivered(
      this.itemsRepository
        .createQueryBuilder('item')
        .withDeleted()
        .innerJoin('item.order', 'order')
        .innerJoin('item.product', 'product'),
      range,
    )
      .select('product.id', 'id')
      .addSelect('product.name', 'name')
      .addSelect('product.slug', 'slug')
      .addSelect('product.deletedAt', 'deletedAt')
      .addSelect('SUM(item.quantity)', 'soldQuantity')
      .addSelect('SUM(item.lineTotal)', 'revenue')
      .addSelect('COUNT(*) OVER ()', 'total')
      .groupBy('product.id')
      .orderBy('SUM(item.quantity)', 'DESC')
      .addOrderBy('SUM(item.lineTotal)', 'DESC')
      .addOrderBy('product.id', 'ASC')
      .limit(limit)
      .getRawMany<BestSellerRow>();
    const thumbnailUrls = await this.thumbnails.urlsOf(
      rows.map(({ id }) => id),
    );

    return {
      products: rows.map((row) => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        isDeleted: row.deletedAt !== null,
        thumbnailUrl: thumbnailUrls.get(row.id) ?? null,
        soldQuantity: Number(row.soldQuantity),
        revenue: Number(row.revenue),
      })),
      total: Number(rows[0]?.total ?? 0),
    };
  }

  async revenueSeries({
    unit,
    step,
    format,
    firstPeriod,
    lastPeriod,
    timeZone,
    range,
  }: RevenueWindow): Promise<RevenuePoint[]> {
    const rows = await this.dataSource
      .createQueryBuilder()
      .select('to_char(series.period, :format)', 'period')
      .addSelect('COUNT(order.id)', 'orders')
      .addSelect('COALESCE(SUM(order.total), 0)', 'revenue')
      .from(
        (periods) =>
          periods
            .select(
              'generate_series(CAST(:firstPeriod AS timestamp), CAST(:lastPeriod AS timestamp), CAST(:step AS interval))',
              'period',
            )
            .fromDummy(),
        'series',
      )
      .leftJoin(
        Order,
        'order',
        [
          DELIVERED_ORDER_CONDITION,
          DELIVERED_IN_RANGE,
          'date_trunc(:unit, order.deliveredAt AT TIME ZONE :timeZone) = series.period',
        ].join(' AND '),
      )
      .groupBy('series.period')
      .orderBy('series.period', 'ASC')
      .setParameters({
        ...range,
        unit,
        step,
        format,
        firstPeriod,
        lastPeriod,
        timeZone,
      })
      .getRawMany<RevenueRow>();

    return rows.map((row) => ({
      period: row.period,
      orders: Number(row.orders),
      revenue: Number(row.revenue),
    }));
  }
}

function delivered<T extends object>(
  builder: SelectQueryBuilder<T>,
  range: DateRange,
): SelectQueryBuilder<T> {
  return builder
    .where(DELIVERED_ORDER_CONDITION)
    .andWhere(DELIVERED_IN_RANGE, range);
}
