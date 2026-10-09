import {
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { Brackets, Repository } from 'typeorm';

import { Order } from '../orders/entities/order.entity';
import { OrderStatus } from '../orders/enums/order-status.enum';
import { AdminUsersQueryDto } from './dto/admin-users-query.dto';
import { buildUser } from './entities/user.fixture';
import { User } from './entities/user.entity';
import { UserRole } from './enums/user-role.enum';
import { UserStatus } from './enums/user-status.enum';
import { UsersAdminService } from './users-admin.service';
import { UsersService } from './users.service';

describe('UsersAdminService', () => {
  const admin = buildUser({
    id: '0d3d3f4e-0000-4000-8000-0000000000aa',
    role: UserRole.Admin,
  });

  let service: UsersAdminService;

  const usersBuilder = {
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(),
  };
  const ordersBuilder = {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    setParameter: jest.fn().mockReturnThis(),
    getRawOne: jest.fn(),
  };
  const usersRepository = { createQueryBuilder: jest.fn(() => usersBuilder) };
  const ordersRepository = { createQueryBuilder: jest.fn(() => ordersBuilder) };
  const usersMock = { findById: jest.fn(), update: jest.fn() };
  const i18nMock = { t: jest.fn((key: string) => key) };

  const query = (overrides: Partial<AdminUsersQueryDto> = {}) =>
    Object.assign(new AdminUsersQueryDto(), overrides);

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);

    service = new UsersAdminService(
      usersRepository as unknown as Repository<User>,
      ordersRepository as unknown as Repository<Order>,
      usersMock as unknown as UsersService,
      i18nMock as unknown as I18nService,
    );

    usersBuilder.getManyAndCount.mockResolvedValue([[], 0]);
    usersMock.update.mockImplementation((user: object, patch: object) =>
      Promise.resolve({ ...user, ...patch }),
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  describe('list', () => {
    it('pages newest first, with the id breaking ties', async () => {
      await service.list(query({ limit: 5, offset: 10 }));

      expect(usersBuilder.orderBy).toHaveBeenCalledWith(
        'user.createdAt',
        'DESC',
      );
      expect(usersBuilder.addOrderBy).toHaveBeenCalledWith('user.id', 'DESC');
      expect(usersBuilder.offset).toHaveBeenCalledWith(10);
      expect(usersBuilder.limit).toHaveBeenCalledWith(5);
    });

    it('returns the page together with the total', async () => {
      const users = [buildUser()];
      usersBuilder.getManyAndCount.mockResolvedValue([users, 41]);

      await expect(service.list(query())).resolves.toEqual([users, 41]);
    });

    it('applies no filter when none is asked for', async () => {
      await service.list(query());

      expect(usersBuilder.andWhere).not.toHaveBeenCalled();
    });

    it('searches email and username with the wildcards escaped', async () => {
      await service.list(query({ q: '50%_off' }));

      expect(usersBuilder.andWhere).toHaveBeenCalledWith(expect.any(Brackets), {
        pattern: '%50\\%\\_off%',
      });
    });

    it('filters by status and role', async () => {
      await service.list(
        query({ status: UserStatus.Inactive, role: UserRole.User }),
      );

      expect(usersBuilder.andWhere).toHaveBeenCalledWith(
        'user.status = :status',
        { status: UserStatus.Inactive },
      );
      expect(usersBuilder.andWhere).toHaveBeenCalledWith('user.role = :role', {
        role: UserRole.User,
      });
    });
  });

  describe('findOne', () => {
    it('returns the account', async () => {
      const user = buildUser();
      usersMock.findById.mockResolvedValue(user);

      await expect(service.findOne(user.id)).resolves.toBe(user);
    });

    it('answers an unknown id with 404', async () => {
      usersMock.findById.mockResolvedValue(null);

      await expect(service.findOne('missing')).rejects.toThrow(
        new NotFoundException('users.NOT_FOUND'),
      );
    });
  });

  describe('orderStats', () => {
    it('aggregates the orders of the account in one query', async () => {
      const lastOrderAt = new Date('2026-10-01T08:30:00.000Z');
      ordersBuilder.getRawOne.mockResolvedValue({
        ordersCount: '3',
        totalSpent: '1500000',
        lastOrderAt,
      });

      await expect(service.orderStats(admin.id)).resolves.toEqual({
        ordersCount: 3,
        totalSpent: 1_500_000,
        lastOrderAt,
      });
      expect(ordersRepository.createQueryBuilder).toHaveBeenCalledTimes(1);
      expect(ordersBuilder.where).toHaveBeenCalledWith(
        'order.userId = :userId',
        { userId: admin.id },
      );
    });

    it('only counts delivered orders towards the amount spent', async () => {
      ordersBuilder.getRawOne.mockResolvedValue(undefined);

      await service.orderStats(admin.id);

      expect(ordersBuilder.setParameter).toHaveBeenCalledWith(
        'delivered',
        OrderStatus.Delivered,
      );
    });

    it('reports zeros for an account without orders', async () => {
      ordersBuilder.getRawOne.mockResolvedValue({
        ordersCount: '0',
        totalSpent: '0',
        lastOrderAt: null,
      });

      await expect(service.orderStats(admin.id)).resolves.toEqual({
        ordersCount: 0,
        totalSpent: 0,
        lastOrderAt: null,
      });
    });
  });

  describe('setStatus', () => {
    it('locks an active account', async () => {
      const target = buildUser();
      usersMock.findById.mockResolvedValue(target);

      await expect(
        service.setStatus(admin, target.id, UserStatus.Inactive),
      ).resolves.toMatchObject({ status: UserStatus.Inactive });
      expect(usersMock.update).toHaveBeenCalledWith(target, {
        status: UserStatus.Inactive,
      });
    });

    it('unlocks an inactive account', async () => {
      const target = buildUser({ status: UserStatus.Inactive });
      usersMock.findById.mockResolvedValue(target);

      await service.setStatus(admin, target.id, UserStatus.Active);

      expect(usersMock.update).toHaveBeenCalledWith(target, {
        status: UserStatus.Active,
      });
    });

    it('refuses to change the status of the calling admin with 422', async () => {
      await expect(
        service.setStatus(admin, admin.id, UserStatus.Inactive),
      ).rejects.toThrow(
        new UnprocessableEntityException('users.CANNOT_CHANGE_OWN_STATUS'),
      );
      expect(usersMock.update).not.toHaveBeenCalled();
    });

    it('answers an unknown id with 404', async () => {
      usersMock.findById.mockResolvedValue(null);

      await expect(
        service.setStatus(admin, 'missing', UserStatus.Inactive),
      ).rejects.toThrow(NotFoundException);
    });

    it('refuses a pending account with 422', async () => {
      const target = buildUser({
        status: UserStatus.Pending,
        emailVerifiedAt: null,
      });
      usersMock.findById.mockResolvedValue(target);

      await expect(
        service.setStatus(admin, target.id, UserStatus.Active),
      ).rejects.toThrow(
        new UnprocessableEntityException('users.USER_NOT_VERIFIED'),
      );
      expect(usersMock.update).not.toHaveBeenCalled();
    });

    it('treats the status the account already has as a no-op', async () => {
      const target = buildUser();
      usersMock.findById.mockResolvedValue(target);

      await expect(
        service.setStatus(admin, target.id, UserStatus.Active),
      ).resolves.toBe(target);
      expect(usersMock.update).not.toHaveBeenCalled();
    });
  });
});
