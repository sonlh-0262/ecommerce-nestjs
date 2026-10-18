import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { APP_CONFIG_KEY, AppConfig } from '../config/configuration';
import { MAIL_FALLBACK_LANGUAGE, MAIL_JOB } from '../mail/mail.constants';
import { MailQueueService } from '../mail/mail-queue.service';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/enums/user-role.enum';
import { UserStatus } from '../users/enums/user-status.enum';
import { CalendarMonth } from './interfaces/stats-period.interface';
import { MonthlyReport } from './interfaces/stats.interface';
import { StatsMetricsService } from './stats-metrics.service';
import { addMonths, monthRange } from './stats-period';
import { MONTHLY_REPORT_TOP_PRODUCTS } from './stats.constants';

@Injectable()
export class MonthlyReportService {
  private readonly logger = new Logger(MonthlyReportService.name);
  private readonly timeZone: string;

  constructor(
    private readonly metrics: StatsMetricsService,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly mail: MailQueueService,
    configService: ConfigService,
  ) {
    this.timeZone =
      configService.getOrThrow<AppConfig>(APP_CONFIG_KEY).timeZone;
  }

  async build(month: CalendarMonth): Promise<MonthlyReport> {
    const range = monthRange(month, this.timeZone);
    const [current, previous, bestSellers] = await Promise.all([
      this.metrics.deliveredTotals(range),
      this.metrics.deliveredTotals(
        monthRange(addMonths(month, -1), this.timeZone),
      ),
      this.metrics.bestSellers(range, MONTHLY_REPORT_TOP_PRODUCTS),
    ]);

    return {
      ...month,
      current,
      previous,
      topProducts: bestSellers.products.map(
        ({ name, soldQuantity, revenue }) => ({ name, soldQuantity, revenue }),
      ),
    };
  }

  async send(month: CalendarMonth): Promise<number> {
    const [report, admins] = await Promise.all([
      this.build(month),
      this.usersRepository.find({
        where: { role: UserRole.Admin, status: UserStatus.Active },
        select: { id: true, email: true, fullName: true },
        order: { email: 'ASC' },
      }),
    ]);

    for (const admin of admins) {
      await this.mail.enqueue(MAIL_JOB.MonthlyRevenueReport, {
        ...report,
        to: admin.email,
        fullName: admin.fullName,
        lang: MAIL_FALLBACK_LANGUAGE,
      });
    }

    this.logger.log(
      `Sent the ${month.year}-${month.month} revenue report to ${admins.length} admins`,
    );

    return admins.length;
  }
}
