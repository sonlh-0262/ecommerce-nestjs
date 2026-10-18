import { MonthlyRevenueReportMailJob } from '../../mail/interfaces/mail-job.interface';
import { OrderStatus } from '../../orders/enums/order-status.enum';
import { RevenueGroupBy } from '../stats.constants';

export interface DeliveredTotals {
  orders: number;
  revenue: number;
}

export interface Audience {
  totalProducts: number;
  totalUsers: number;
  newUsers: number;
}

export interface StatsOverview extends Audience {
  totalRevenue: number;
  totalOrders: number;
  deliveredOrders: number;
  ordersByStatus: Record<OrderStatus, number>;
}

export interface BestSeller {
  id: string;
  name: string;
  slug: string;
  isDeleted: boolean;
  thumbnailUrl: string | null;
  soldQuantity: number;
  revenue: number;
}

export interface BestSellerPage {
  products: BestSeller[];
  total: number;
}

export interface RevenuePoint {
  period: string;
  orders: number;
  revenue: number;
}

export interface RevenueReport {
  groupBy: RevenueGroupBy;
  total: number;
  series: RevenuePoint[];
}

export type MonthlyReport = Omit<
  MonthlyRevenueReportMailJob,
  'to' | 'fullName' | 'lang'
>;
