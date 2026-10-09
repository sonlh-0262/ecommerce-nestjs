import {
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { I18nService } from 'nestjs-i18n';
import { Brackets, Repository } from 'typeorm';

import { containsPattern } from '../common/helpers/escape-like';
import { Order } from '../orders/entities/order.entity';
import { OrderStatus } from '../orders/enums/order-status.enum';
import { AdminUsersQueryDto } from './dto/admin-users-query.dto';
import { User } from './entities/user.entity';
import { UserStatus } from './enums/user-status.enum';
import { UserOrderStats } from './interfaces/user-order-stats.interface';
import { AdminSettableStatus } from './users.constants';
import { UsersService } from './users.service';

interface OrderStatsRow {
  ordersCount: string;
  totalSpent: string;
  lastOrderAt: Date | null;
}

@Injectable()
export class UsersAdminService {
  private readonly logger = new Logger(UsersAdminService.name);

  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Order)
    private readonly ordersRepository: Repository<Order>,
    private readonly usersService: UsersService,
    private readonly i18n: I18nService,
  ) {}

  list(query: AdminUsersQueryDto): Promise<[User[], number]> {
    const builder = this.usersRepository
      .createQueryBuilder('user')
      .orderBy('user.createdAt', 'DESC')
      .addOrderBy('user.id', 'DESC')
      .offset(query.offset)
      .limit(query.limit);

    if (query.q) {
      builder.andWhere(
        new Brackets((match) =>
          match
            .where('user.email ILIKE :pattern')
            .orWhere('user.username ILIKE :pattern'),
        ),
        { pattern: containsPattern(query.q) },
      );
    }

    if (query.status) {
      builder.andWhere('user.status = :status', { status: query.status });
    }

    if (query.role) {
      builder.andWhere('user.role = :role', { role: query.role });
    }

    return builder.getManyAndCount();
  }

  async findOne(id: string): Promise<User> {
    const user = await this.usersService.findById(id);

    if (!user) {
      throw new NotFoundException(this.i18n.t('users.NOT_FOUND'));
    }

    return user;
  }

  async orderStats(userId: string): Promise<UserOrderStats> {
    const row = await this.ordersRepository
      .createQueryBuilder('order')
      .select('COUNT(*)', 'ordersCount')
      .addSelect(
        'COALESCE(SUM(order.total) FILTER (WHERE order.status = :delivered), 0)',
        'totalSpent',
      )
      .addSelect('MAX(order.createdAt)', 'lastOrderAt')
      .where('order.userId = :userId', { userId })
      .setParameter('delivered', OrderStatus.Delivered)
      .getRawOne<OrderStatsRow>();

    return {
      ordersCount: Number(row?.ordersCount ?? 0),
      totalSpent: Number(row?.totalSpent ?? 0),
      lastOrderAt: row?.lastOrderAt ?? null,
    };
  }

  async setStatus(
    admin: User,
    id: string,
    status: AdminSettableStatus,
  ): Promise<User> {
    if (id === admin.id) {
      throw new UnprocessableEntityException(
        this.i18n.t('users.CANNOT_CHANGE_OWN_STATUS'),
      );
    }

    const target = await this.findOne(id);

    if (target.status === UserStatus.Pending) {
      throw new UnprocessableEntityException(
        this.i18n.t('users.USER_NOT_VERIFIED'),
      );
    }

    if (target.status === status) {
      return target;
    }

    const updated = await this.usersService.update(target, { status });

    this.logger.log(`Admin ${admin.id} set user ${id} to ${status}`);

    return updated;
  }
}
