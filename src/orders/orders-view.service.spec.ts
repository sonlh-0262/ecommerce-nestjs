import { NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { In, Repository } from 'typeorm';

import { ProductThumbnailsService } from '../products/product-thumbnails.service';
import { OrdersQueryDto } from './dto/orders-query.dto';
import { OrderItem } from './entities/order-item.entity';
import { OrderStatusHistory } from './entities/order-status-history.entity';
import { Order } from './entities/order.entity';
import { OrderStatus } from './enums/order-status.enum';
import { OrdersViewService } from './orders-view.service';

describe('OrdersViewService', () => {
  const USER_ID = 'u1';

  const order = (id: string) => ({ id, code: `ORD-${id}` }) as Order;
  const item = (orderId: string, productId: string, productName: string) =>
    ({
      id: `${orderId}-${productId}`,
      orderId,
      productId,
      productName,
    }) as OrderItem;

  const builder = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(),
  };
  const ordersRepository = {
    createQueryBuilder: jest.fn(() => builder),
    findOneBy: jest.fn(),
  };
  const itemsRepository = { find: jest.fn() };
  const historyRepository = { find: jest.fn() };
  const thumbnailsMock = { urlsOf: jest.fn() };
  const i18nMock = { t: jest.fn((key: string) => key) };

  const service = new OrdersViewService(
    ordersRepository as unknown as Repository<Order>,
    itemsRepository as unknown as Repository<OrderItem>,
    historyRepository as unknown as Repository<OrderStatusHistory>,
    thumbnailsMock as unknown as ProductThumbnailsService,
    i18nMock as unknown as I18nService,
  );

  const query = (overrides: Partial<OrdersQueryDto> = {}) =>
    Object.assign(new OrdersQueryDto(), overrides);

  beforeEach(() => {
    builder.getManyAndCount.mockResolvedValue([[], 0]);
    itemsRepository.find.mockResolvedValue([]);
    historyRepository.find.mockResolvedValue([]);
    thumbnailsMock.urlsOf.mockResolvedValue(new Map());
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('list', () => {
    it('lists only my orders, newest first, one page at a time', async () => {
      await service.list(USER_ID, query({ limit: 5, offset: 10 }));

      expect(builder.where).toHaveBeenCalledWith('order.userId = :userId', {
        userId: USER_ID,
      });
      expect(builder.orderBy).toHaveBeenCalledWith('order.createdAt', 'DESC');
      expect(builder.addOrderBy).toHaveBeenCalledWith('order.id', 'DESC');
      expect(builder.offset).toHaveBeenCalledWith(10);
      expect(builder.limit).toHaveBeenCalledWith(5);
      expect(builder.andWhere).not.toHaveBeenCalled();
    });

    it('filters on status and on the creation time', async () => {
      await service.list(
        USER_ID,
        query({
          status: OrderStatus.Cancelled,
          from: '2026-10-01T00:00:00Z',
          to: '2026-10-31T23:59:59Z',
        }),
      );

      expect(builder.andWhere).toHaveBeenCalledWith('order.status = :status', {
        status: OrderStatus.Cancelled,
      });
      expect(builder.andWhere).toHaveBeenCalledWith(
        'order.createdAt >= :from',
        { from: new Date('2026-10-01T00:00:00Z') },
      );
      expect(builder.andWhere).toHaveBeenCalledWith('order.createdAt <= :to', {
        to: new Date('2026-10-31T23:59:59Z'),
      });
    });

    it('loads a page with exactly 3 queries', async () => {
      builder.getManyAndCount.mockResolvedValue([
        [order('o1'), order('o2')],
        7,
      ]);
      itemsRepository.find.mockResolvedValue([
        item('o1', 'p1', 'Áo thun'),
        item('o1', 'p2', 'Mũ'),
        item('o2', 'p3', 'Quần'),
      ]);

      await service.list(USER_ID, query());

      expect(builder.getManyAndCount).toHaveBeenCalledTimes(1);
      expect(itemsRepository.find).toHaveBeenCalledTimes(1);
      expect(itemsRepository.find).toHaveBeenCalledWith({
        where: { orderId: In(['o1', 'o2']) },
        order: { productName: 'ASC', id: 'ASC' },
      });
      expect(thumbnailsMock.urlsOf).toHaveBeenCalledTimes(1);
      expect(thumbnailsMock.urlsOf).toHaveBeenCalledWith(['p1', 'p3']);
    });

    it('summarises each order by its item count and first item', async () => {
      builder.getManyAndCount.mockResolvedValue([
        [order('o1'), order('o2')],
        7,
      ]);
      itemsRepository.find.mockResolvedValue([
        item('o1', 'p1', 'Áo thun'),
        item('o1', 'p2', 'Mũ'),
        item('o2', 'p3', 'Quần'),
      ]);
      thumbnailsMock.urlsOf.mockResolvedValue(new Map([['p1', '/thumb-p1']]));

      const page = await service.list(USER_ID, query());

      expect(page.total).toBe(7);
      expect(page.summaries).toEqual([
        {
          order: order('o1'),
          itemsCount: 2,
          firstItem: item('o1', 'p1', 'Áo thun'),
          thumbnailUrl: '/thumb-p1',
        },
        {
          order: order('o2'),
          itemsCount: 1,
          firstItem: item('o2', 'p3', 'Quần'),
          thumbnailUrl: null,
        },
      ]);
    });

    it('skips the item query for an empty page', async () => {
      await expect(service.list(USER_ID, query())).resolves.toEqual({
        summaries: [],
        total: 0,
      });
      expect(itemsRepository.find).not.toHaveBeenCalled();
    });
  });

  describe('findOwned', () => {
    it('answers 404 for an order that is not mine', async () => {
      ordersRepository.findOneBy.mockResolvedValue(null);

      await expect(service.findOwned(USER_ID, 'ORD-x')).rejects.toThrow(
        new NotFoundException('orders.NOT_FOUND'),
      );
      expect(ordersRepository.findOneBy).toHaveBeenCalledWith({
        code: 'ORD-x',
        userId: USER_ID,
      });
    });

    it('returns the order with its items, history and thumbnails', async () => {
      const items = [item('o1', 'p1', 'Áo thun')];
      const history = [{ id: 'h1' } as OrderStatusHistory];
      ordersRepository.findOneBy.mockResolvedValue(order('o1'));
      itemsRepository.find.mockResolvedValue(items);
      historyRepository.find.mockResolvedValue(history);
      thumbnailsMock.urlsOf.mockResolvedValue(new Map([['p1', '/thumb']]));

      await expect(service.findOwned(USER_ID, 'ORD-o1')).resolves.toEqual({
        order: order('o1'),
        items,
        history,
        thumbnailUrls: new Map([['p1', '/thumb']]),
      });
      expect(historyRepository.find).toHaveBeenCalledWith({
        where: { orderId: 'o1' },
        order: { createdAt: 'ASC', id: 'ASC' },
      });
    });
  });
});
