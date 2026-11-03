import {
  toBestSellersResponse,
  toRevenueResponse,
  toStatsOverviewResponse,
} from './stats.dto';

describe('stats mappers', () => {
  it('wraps the overview in a stats envelope', () => {
    const ordersByStatus = {
      PENDING: 1,
      CONFIRMED: 0,
      SHIPPING: 0,
      DELIVERED: 4,
      CANCELLED: 2,
      REJECTED: 0,
    };

    expect(
      toStatsOverviewResponse({
        totalRevenue: 1_200_000,
        totalOrders: 7,
        deliveredOrders: 4,
        totalProducts: 50,
        totalUsers: 6,
        newUsers: 2,
        ordersByStatus,
      }),
    ).toEqual({
      stats: {
        totalRevenue: 1_200_000,
        totalOrders: 7,
        deliveredOrders: 4,
        totalProducts: 50,
        totalUsers: 6,
        newUsers: 2,
        ordersByStatus,
      },
    });
  });

  it('lists the best sellers with the count of products sold', () => {
    const product = {
      id: 'p1',
      name: 'Áo thun',
      slug: 'ao-thun',
      isDeleted: true,
      thumbnailUrl: null,
      soldQuantity: 4,
      revenue: 800_000,
    };

    expect(toBestSellersResponse({ products: [product], total: 12 })).toEqual({
      products: [product],
      productsCount: 12,
    });
  });

  it('wraps the revenue series', () => {
    const series = [{ period: '2026', orders: 3, revenue: 900_000 }];

    expect(
      toRevenueResponse({ groupBy: 'year', total: 900_000, series }),
    ).toEqual({ revenue: { groupBy: 'year', total: 900_000, series } });
  });
});
