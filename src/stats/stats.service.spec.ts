import { UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { I18nService } from 'nestjs-i18n';

import { CacheService } from '../cache/cache.service';
import { CACHE_RESOURCES } from '../common/constants/cache-keys';
import { StatsRangeQueryDto } from './dto/stats-range-query.dto';
import { StatsMetricsService } from './stats-metrics.service';
import { StatsService } from './stats.service';
import { STATS_OVERVIEW_CACHE_TTL_SECONDS } from './stats.constants';

describe('StatsService', () => {
  const NOW = new Date('2026-10-18T03:00:00.000Z');
  const TIME_ZONE = 'Asia/Ho_Chi_Minh';

  const metricsMock = {
    deliveredTotals: jest.fn(),
    ordersByStatus: jest.fn(),
    audience: jest.fn(),
    bestSellers: jest.fn(),
    revenueSeries: jest.fn(),
  };
  const cacheMock = {
    getOrSet: jest.fn(
      (
        _resource: string,
        _variant: unknown[],
        _ttl: number,
        factory: () => Promise<unknown>,
      ) => factory(),
    ),
  };
  const i18nMock = { t: jest.fn((key: string) => key) };
  const configMock = { getOrThrow: () => ({ timeZone: TIME_ZONE }) };

  const service = new StatsService(
    metricsMock as unknown as StatsMetricsService,
    cacheMock as unknown as CacheService,
    i18nMock as unknown as I18nService,
    configMock as unknown as ConfigService,
  );

  beforeEach(() => {
    jest.useFakeTimers({ now: NOW });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  describe('overview', () => {
    beforeEach(() => {
      metricsMock.deliveredTotals.mockResolvedValue({
        orders: 4,
        revenue: 1_200_000,
      });
      metricsMock.ordersByStatus.mockResolvedValue({
        PENDING: 1,
        CONFIRMED: 0,
        SHIPPING: 0,
        DELIVERED: 4,
        CANCELLED: 2,
        REJECTED: 0,
      });
      metricsMock.audience.mockResolvedValue({
        totalProducts: 50,
        totalUsers: 6,
        newUsers: 2,
      });
    });

    it('covers the last twelve months by default and caches the answer', async () => {
      await expect(service.overview({})).resolves.toEqual({
        totalRevenue: 1_200_000,
        deliveredOrders: 4,
        totalOrders: 7,
        totalProducts: 50,
        totalUsers: 6,
        newUsers: 2,
        ordersByStatus: expect.objectContaining({ CANCELLED: 2 }) as object,
      });

      const range = {
        from: new Date('2025-10-18T03:00:00.000Z'),
        to: NOW,
      };

      expect(metricsMock.deliveredTotals).toHaveBeenCalledWith(range);
      expect(metricsMock.ordersByStatus).toHaveBeenCalledWith(range);
      expect(cacheMock.getOrSet).toHaveBeenCalledWith(
        CACHE_RESOURCES.stats,
        ['overview', '', ''],
        STATS_OVERVIEW_CACHE_TTL_SECONDS,
        expect.any(Function),
      );
    });

    it('keys the cache on the range it was asked for', async () => {
      const query: StatsRangeQueryDto = {
        from: '2026-01-01T00:00:00+07:00',
        to: '2026-07-01T00:00:00+07:00',
      };

      await service.overview(query);

      expect(cacheMock.getOrSet).toHaveBeenCalledWith(
        CACHE_RESOURCES.stats,
        ['overview', query.from, query.to],
        STATS_OVERVIEW_CACHE_TTL_SECONDS,
        expect.any(Function),
      );
    });

    it('refuses a range that ends before it starts with 422', async () => {
      await expect(
        service.overview({ from: '2026-05-01', to: '2026-01-01' }),
      ).rejects.toThrow(
        new UnprocessableEntityException('stats.INVALID_RANGE'),
      );

      expect(cacheMock.getOrSet).not.toHaveBeenCalled();
    });
  });

  describe('bestSellers', () => {
    it('ranks over the range with the limit asked for', async () => {
      metricsMock.bestSellers.mockResolvedValue({ products: [], total: 0 });

      await service.bestSellers({
        from: '2026-01-01T00:00:00Z',
        limit: 5,
      });

      expect(metricsMock.bestSellers).toHaveBeenCalledWith(
        { from: new Date('2026-01-01T00:00:00Z'), to: NOW },
        5,
      );
    });

    it('refuses a reversed range', async () => {
      await expect(
        service.bestSellers({
          from: '2026-05-01',
          to: '2026-01-01',
          limit: 10,
        }),
      ).rejects.toThrow(UnprocessableEntityException);
    });
  });

  describe('revenue', () => {
    const SERIES = [
      { period: '2026-01', orders: 1, revenue: 330_000 },
      { period: '2026-02', orders: 0, revenue: 0 },
      { period: '2026-03', orders: 2, revenue: 500_000 },
    ];

    it('adds the periods up into the total', async () => {
      metricsMock.revenueSeries.mockResolvedValue(SERIES);

      await expect(
        service.revenue({ groupBy: 'month', year: 2026 }),
      ).resolves.toEqual({ groupBy: 'month', total: 830_000, series: SERIES });
      expect(metricsMock.revenueSeries).toHaveBeenCalledWith(
        expect.objectContaining({
          firstPeriod: '2026-01-01',
          lastPeriod: '2026-12-01',
          timeZone: TIME_ZONE,
        }),
      );
    });

    it('defaults to the current year in the shop time zone', async () => {
      jest.setSystemTime(new Date('2026-12-31T18:00:00.000Z'));
      metricsMock.revenueSeries.mockResolvedValue([]);

      await service.revenue({ groupBy: 'year' });

      expect(metricsMock.revenueSeries).toHaveBeenCalledWith(
        expect.objectContaining({
          firstPeriod: '2023-01-01',
          lastPeriod: '2027-01-01',
        }),
      );
    });
  });
});
