import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CacheModule } from '../cache/cache.module';
import { MailModule } from '../mail/mail.module';
import { OrderItem } from '../orders/entities/order-item.entity';
import { Order } from '../orders/entities/order.entity';
import { ProductsModule } from '../products/products.module';
import { User } from '../users/entities/user.entity';
import { MonthlyReportScheduler } from './monthly-report.scheduler';
import { MonthlyReportService } from './monthly-report.service';
import { StatsAdminController } from './stats-admin.controller';
import { StatsMetricsService } from './stats-metrics.service';
import { StatsService } from './stats.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem, User]),
    CacheModule,
    MailModule,
    ProductsModule,
  ],
  controllers: [StatsAdminController],
  providers: [
    StatsService,
    StatsMetricsService,
    MonthlyReportService,
    MonthlyReportScheduler,
  ],
  exports: [MonthlyReportScheduler],
})
export class StatsModule {}
