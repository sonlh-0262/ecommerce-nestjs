import { ApiProperty } from '@nestjs/swagger';

import { paginated } from '../../common/helpers/paginated';
import { OrderStatus } from '../../orders/enums/order-status.enum';
import {
  BestSeller,
  BestSellerPage,
  RevenueReport,
  StatsOverview,
} from '../interfaces/stats.interface';
import { REVENUE_GROUP_BY, RevenueGroupBy } from '../stats.constants';

export class StatsOverviewDto {
  @ApiProperty({
    description:
      'Sum of the totals of the orders DELIVERED in the range, by delivery date, in VND.',
    example: 125000000,
  })
  totalRevenue: number;

  @ApiProperty({
    description: 'Orders placed in the range, by creation date.',
    example: 320,
  })
  totalOrders: number;

  @ApiProperty({
    description: 'Orders delivered in the range, by delivery date.',
    example: 210,
  })
  deliveredOrders: number;

  @ApiProperty({
    description: 'Products not deleted, whatever their status.',
    example: 50,
  })
  totalProducts: number;

  @ApiProperty({ description: 'Customer accounts.', example: 180 })
  totalUsers: number;

  @ApiProperty({
    description: 'Customer accounts created in the range.',
    example: 24,
  })
  newUsers: number;

  @ApiProperty({
    type: 'object',
    properties: Object.fromEntries(
      Object.values(OrderStatus).map((status) => [status, { type: 'integer' }]),
    ),
    description:
      'Orders placed in the range by their current status - by creation ' +
      'date, unlike the revenue, which follows the delivery date.',
    example: {
      PENDING: 12,
      CONFIRMED: 8,
      SHIPPING: 5,
      DELIVERED: 210,
      CANCELLED: 60,
      REJECTED: 25,
    },
  })
  ordersByStatus: Record<OrderStatus, number>;
}

export class StatsOverviewResponseDto {
  @ApiProperty({ type: StatsOverviewDto })
  stats: StatsOverviewDto;
}

export class BestSellerDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({
    description: 'Current name of the product, not the one ordered.',
    example: 'Áo thun cotton basic',
  })
  name: string;

  @ApiProperty({ example: 'ao-thun-cotton-basic' })
  slug: string;

  @ApiProperty({
    description: 'The product has been deleted since it was sold.',
  })
  isDeleted: boolean;

  @ApiProperty({ nullable: true, example: null })
  thumbnailUrl: string | null;

  @ApiProperty({ example: 42 })
  soldQuantity: number;

  @ApiProperty({ description: 'Sum of the line totals, in VND.' })
  revenue: number;
}

export class BestSellersResponseDto {
  @ApiProperty({
    type: [BestSellerDto],
    description: 'Most units delivered first.',
  })
  products: BestSellerDto[];

  @ApiProperty({
    description: 'Products delivered at least once in the range.',
    example: 37,
  })
  productsCount: number;
}

export class RevenuePointDto {
  @ApiProperty({ example: '2026-01', description: 'YYYY-MM or YYYY.' })
  period: string;

  @ApiProperty({ example: 12 })
  orders: number;

  @ApiProperty({ example: 8500000 })
  revenue: number;
}

export class RevenueDto {
  @ApiProperty({ enum: REVENUE_GROUP_BY })
  groupBy: RevenueGroupBy;

  @ApiProperty({ example: 125000000 })
  total: number;

  @ApiProperty({
    type: [RevenuePointDto],
    description: 'Every period of the window in order, empty ones at 0.',
  })
  series: RevenuePointDto[];
}

export class RevenueResponseDto {
  @ApiProperty({ type: RevenueDto })
  revenue: RevenueDto;
}

export function toStatsOverviewResponse(
  overview: StatsOverview,
): StatsOverviewResponseDto {
  return {
    stats: {
      totalRevenue: overview.totalRevenue,
      totalOrders: overview.totalOrders,
      deliveredOrders: overview.deliveredOrders,
      totalProducts: overview.totalProducts,
      totalUsers: overview.totalUsers,
      newUsers: overview.newUsers,
      ordersByStatus: { ...overview.ordersByStatus },
    },
  };
}

function toBestSellerDto(product: BestSeller): BestSellerDto {
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    isDeleted: product.isDeleted,
    thumbnailUrl: product.thumbnailUrl,
    soldQuantity: product.soldQuantity,
    revenue: product.revenue,
  };
}

export function toBestSellersResponse(
  page: BestSellerPage,
): BestSellersResponseDto {
  return paginated('products', page.products.map(toBestSellerDto), page.total);
}

export function toRevenueResponse(report: RevenueReport): RevenueResponseDto {
  return {
    revenue: {
      groupBy: report.groupBy,
      total: report.total,
      series: report.series.map(({ period, orders, revenue }) => ({
        period,
        orders,
        revenue,
      })),
    },
  };
}
