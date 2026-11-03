import { DataSource, Repository } from 'typeorm';

import { OrderItem } from '../orders/entities/order-item.entity';
import { Order } from '../orders/entities/order.entity';
import { OrderStatus } from '../orders/enums/order-status.enum';
import { Product } from '../products/entities/product.entity';
import { ProductThumbnailsService } from '../products/product-thumbnails.service';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/enums/user-role.enum';
import { revenueWindow } from './stats-period';
import { StatsMetricsService } from './stats-metrics.service';
import { DELIVERED_ORDER_CONDITION } from './stats.constants';

type BuilderMock = Record<string, jest.Mock>;

const CHAINED = [
  'select',
  'addSelect',
  'from',
  'fromDummy',
  'where',
  'andWhere',
  'innerJoin',
  'leftJoin',
  'withDeleted',
  'groupBy',
  'orderBy',
  'addOrderBy',
  'limit',
  'setParameters',
];

function builderMock(): BuilderMock {
  const builder: BuilderMock = {
    getRawOne: jest.fn(),
    getRawMany: jest.fn(),
  };

  for (const method of CHAINED) {
    builder[method] = jest.fn().mockReturnValue(builder);
  }

  return builder;
}

describe('StatsMetricsService', () => {
  const RANGE = {
    from: new Date('2026-01-01T00:00:00.000Z'),
    to: new Date('2026-07-01T00:00:00.000Z'),
  };

  let builder: BuilderMock;

  const repository = () => ({ createQueryBuilder: jest.fn(() => builder) });
  const ordersRepository = repository();
  const itemsRepository = repository();
  const usersRepository = repository();
  const dataSource = repository();
  const thumbnailsMock = { urlsOf: jest.fn() };

  const service = new StatsMetricsService(
    dataSource as unknown as DataSource,
    ordersRepository as unknown as Repository<Order>,
    itemsRepository as unknown as Repository<OrderItem>,
    usersRepository as unknown as Repository<User>,
    thumbnailsMock as unknown as ProductThumbnailsService,
  );

  beforeEach(() => {
    builder = builderMock();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('deliveredTotals', () => {
    it('counts DELIVERED orders only, by delivery date', async () => {
      builder.getRawOne.mockResolvedValue({ orders: '3', revenue: '450000' });

      await expect(service.deliveredTotals(RANGE)).resolves.toEqual({
        orders: 3,
        revenue: 450000,
      });

      expect(builder.where).toHaveBeenCalledWith(DELIVERED_ORDER_CONDITION);
      expect(builder.andWhere).toHaveBeenCalledWith(
        'order.deliveredAt >= :from AND order.deliveredAt < :to',
        RANGE,
      );
    });

    it('spells the status out so the partial index applies', () => {
      expect(DELIVERED_ORDER_CONDITION).toBe(
        `order.status = '${OrderStatus.Delivered}'`,
      );
    });

    it('reads a missing row as nothing sold', async () => {
      builder.getRawOne.mockResolvedValue(undefined);

      await expect(service.deliveredTotals(RANGE)).resolves.toEqual({
        orders: 0,
        revenue: 0,
      });
    });
  });

  describe('ordersByStatus', () => {
    it('groups the orders created in the range and lists every status', async () => {
      builder.getRawMany.mockResolvedValue([
        { status: OrderStatus.Pending, count: '2' },
        { status: OrderStatus.Delivered, count: '5' },
      ]);

      await expect(service.ordersByStatus(RANGE)).resolves.toEqual({
        PENDING: 2,
        CONFIRMED: 0,
        SHIPPING: 0,
        DELIVERED: 5,
        CANCELLED: 0,
        REJECTED: 0,
      });
      expect(builder.where).toHaveBeenCalledWith(
        'order.createdAt >= :from AND order.createdAt < :to',
        RANGE,
      );
    });
  });

  describe('audience', () => {
    it('counts customers, new customers and products in one query', async () => {
      builder.getRawOne.mockResolvedValue({
        totalProducts: '50',
        totalUsers: '6',
        newUsers: '2',
      });

      await expect(service.audience(RANGE)).resolves.toEqual({
        totalProducts: 50,
        totalUsers: 6,
        newUsers: 2,
      });
      expect(builder.where).toHaveBeenCalledWith('user.role = :role', {
        role: UserRole.User,
      });
      expect(builder.setParameters).toHaveBeenCalledWith(RANGE);

      const products = builderMock();
      const [, [subQuery]] = builder.addSelect.mock.calls as [
        unknown,
        [(qb: BuilderMock) => BuilderMock],
      ];

      subQuery(products);

      expect(products.from).toHaveBeenCalledWith(Product, 'product');
    });
  });

  describe('bestSellers', () => {
    it('ranks products of delivered orders, deleted ones included', async () => {
      builder.getRawMany.mockResolvedValue([
        {
          id: 'p1',
          name: 'Áo thun',
          slug: 'ao-thun',
          deletedAt: null,
          soldQuantity: '7',
          revenue: '1400000',
          total: '2',
        },
        {
          id: 'p2',
          name: 'Quần jean',
          slug: 'quan-jean',
          deletedAt: new Date('2026-05-01T00:00:00.000Z'),
          soldQuantity: '3',
          revenue: '900000',
          total: '2',
        },
      ]);
      thumbnailsMock.urlsOf.mockResolvedValue(
        new Map([['p1', '/api/v1/attachments/a1']]),
      );

      await expect(service.bestSellers(RANGE, 10)).resolves.toEqual({
        products: [
          {
            id: 'p1',
            name: 'Áo thun',
            slug: 'ao-thun',
            isDeleted: false,
            thumbnailUrl: '/api/v1/attachments/a1',
            soldQuantity: 7,
            revenue: 1400000,
          },
          {
            id: 'p2',
            name: 'Quần jean',
            slug: 'quan-jean',
            isDeleted: true,
            thumbnailUrl: null,
            soldQuantity: 3,
            revenue: 900000,
          },
        ],
        total: 2,
      });

      expect(builder.withDeleted.mock.invocationCallOrder[0]).toBeLessThan(
        builder.innerJoin.mock.invocationCallOrder[0],
      );
      expect(builder.where).toHaveBeenCalledWith(DELIVERED_ORDER_CONDITION);
      expect(builder.groupBy).toHaveBeenCalledWith('product.id');
      expect(builder.orderBy).toHaveBeenCalledWith(
        'SUM(item.quantity)',
        'DESC',
      );
      expect(builder.limit).toHaveBeenCalledWith(10);
    });

    it('reports no product when nothing was delivered', async () => {
      builder.getRawMany.mockResolvedValue([]);
      thumbnailsMock.urlsOf.mockResolvedValue(new Map());

      await expect(service.bestSellers(RANGE, 10)).resolves.toEqual({
        products: [],
        total: 0,
      });
    });
  });

  describe('revenueSeries', () => {
    const WINDOW = revenueWindow('month', 2026, 'Asia/Ho_Chi_Minh');

    it('frames the periods with generate_series and joins delivered orders', async () => {
      builder.getRawMany.mockResolvedValue([
        { period: '2026-01', orders: '0', revenue: '0' },
        { period: '2026-02', orders: '2', revenue: '330000' },
      ]);

      await expect(service.revenueSeries(WINDOW)).resolves.toEqual([
        { period: '2026-01', orders: 0, revenue: 0 },
        { period: '2026-02', orders: 2, revenue: 330000 },
      ]);

      expect(builder.setParameters).toHaveBeenCalledWith({
        ...WINDOW.range,
        unit: 'month',
        step: '1 month',
        format: 'YYYY-MM',
        firstPeriod: '2026-01-01',
        lastPeriod: '2026-12-01',
        timeZone: 'Asia/Ho_Chi_Minh',
      });

      const [[, , condition]] = builder.leftJoin.mock.calls as [
        [unknown, string, string],
      ];

      expect(condition).toContain(DELIVERED_ORDER_CONDITION);
      expect(condition).toContain(
        'date_trunc(:unit, order.deliveredAt AT TIME ZONE :timeZone)',
      );

      const periods = builderMock();
      const [[framePeriods, alias]] = builder.from.mock.calls as [
        [(qb: BuilderMock) => BuilderMock, string],
      ];

      framePeriods(periods);

      expect(alias).toBe('series');
      expect(periods.select).toHaveBeenCalledWith(
        expect.stringContaining('generate_series'),
        'period',
      );
      expect(periods.fromDummy).toHaveBeenCalled();
    });
  });
});
