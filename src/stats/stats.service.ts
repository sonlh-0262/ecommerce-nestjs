import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { I18nService } from 'nestjs-i18n';

import { CacheService } from '../cache/cache.service';
import { CACHE_RESOURCES } from '../common/constants/cache-keys';
import { APP_CONFIG_KEY, AppConfig } from '../config/configuration';
import { BestSellersQueryDto } from './dto/best-sellers-query.dto';
import { RevenueQueryDto } from './dto/revenue-query.dto';
import { StatsRangeQueryDto } from './dto/stats-range-query.dto';
import { DateRange } from './interfaces/stats-period.interface';
import {
  BestSellerPage,
  RevenueReport,
  StatsOverview,
} from './interfaces/stats.interface';
import { StatsMetricsService } from './stats-metrics.service';
import { monthOf, resolveRange, revenueWindow } from './stats-period';
import { STATS_OVERVIEW_CACHE_TTL_SECONDS } from './stats.constants';

@Injectable()
export class StatsService {
  private readonly timeZone: string;

  constructor(
    private readonly metrics: StatsMetricsService,
    private readonly cache: CacheService,
    private readonly i18n: I18nService,
    configService: ConfigService,
  ) {
    this.timeZone =
      configService.getOrThrow<AppConfig>(APP_CONFIG_KEY).timeZone;
  }

  async overview(query: StatsRangeQueryDto): Promise<StatsOverview> {
    const range = this.rangeOf(query);

    return this.cache.getOrSet(
      CACHE_RESOURCES.stats,
      ['overview', query.from ?? '', query.to ?? ''],
      STATS_OVERVIEW_CACHE_TTL_SECONDS,
      () => this.overviewOf(range),
    );
  }

  async bestSellers(query: BestSellersQueryDto): Promise<BestSellerPage> {
    return this.metrics.bestSellers(this.rangeOf(query), query.limit);
  }

  async revenue({ groupBy, year }: RevenueQueryDto): Promise<RevenueReport> {
    const series = await this.metrics.revenueSeries(
      revenueWindow(
        groupBy,
        year ?? monthOf(new Date(), this.timeZone).year,
        this.timeZone,
      ),
    );

    return {
      groupBy,
      total: series.reduce((sum, point) => sum + point.revenue, 0),
      series,
    };
  }

  private async overviewOf(range: DateRange): Promise<StatsOverview> {
    const [delivered, ordersByStatus, audience] = await Promise.all([
      this.metrics.deliveredTotals(range),
      this.metrics.ordersByStatus(range),
      this.metrics.audience(range),
    ]);

    return {
      ...audience,
      totalRevenue: delivered.revenue,
      deliveredOrders: delivered.orders,
      totalOrders: Object.values(ordersByStatus).reduce(
        (sum, count) => sum + count,
        0,
      ),
      ordersByStatus,
    };
  }

  private rangeOf({ from, to }: StatsRangeQueryDto): DateRange {
    const range = resolveRange(from, to, new Date());

    if (range.from > range.to) {
      throw new UnprocessableEntityException(
        this.i18n.t('stats.INVALID_RANGE'),
      );
    }

    return range;
  }
}
