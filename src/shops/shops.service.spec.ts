import {
  ConflictException,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { EntityManager, Repository } from 'typeorm';

import { CacheService } from '../cache/cache.service';
import { CACHE_RESOURCES } from '../common/constants/cache-keys';
import { transactionalDataSource } from '../database/transaction.fixture';
import { MAIL_FALLBACK_LANGUAGE, MAIL_JOB } from '../mail/mail.constants';
import { MailQueueService } from '../mail/mail-queue.service';
import { buildUser } from '../users/entities/user.fixture';
import { User } from '../users/entities/user.entity';
import { buildShop } from './entities/shop.fixture';
import { Shop } from './entities/shop.entity';
import { ShopStatus } from './enums/shop-status.enum';
import { ShopsViewService } from './shops-view.service';
import { ShopsService } from './shops.service';

describe('ShopsService', () => {
  const OWNER = buildUser({ id: 'u1' });
  const ADMIN = buildUser({ id: 'a1' });
  const INPUT = {
    name: 'Nhà Sách Hà Nội',
    phone: '0901234567',
    address: '12 Hang Bai, Ha Noi',
  };
  const NOW = new Date('2026-11-05T04:00:00.000Z');

  const pending = (overrides: Partial<Shop> = {}) =>
    buildShop({
      ownerId: OWNER.id,
      status: ShopStatus.Pending,
      reviewedBy: null,
      reviewedAt: null,
      ...overrides,
    });

  const managerMock = {
    findOne: jest.fn(),
    existsBy: jest.fn(),
    create: jest.fn((_entity: unknown, values: object) => values),
    save: jest.fn((value: object) =>
      Promise.resolve({ id: 'shop-1', ...value }),
    ),
    update: jest.fn(),
    findOneByOrFail: jest.fn(),
  };
  const { dataSource } = transactionalDataSource(
    managerMock as unknown as EntityManager,
  );
  const shopsRepository = { existsBy: jest.fn() };
  const cacheMock = { invalidate: jest.fn() };
  const viewMock = {
    adminViewOf: jest.fn((shop: Shop) =>
      Promise.resolve({ shop, owner: OWNER }),
    ),
  };
  const mailMock = { enqueue: jest.fn() };
  const i18nMock = { t: jest.fn((key: string) => key) };

  const service = new ShopsService(
    shopsRepository as unknown as Repository<Shop>,
    dataSource,
    viewMock as unknown as ShopsViewService,
    mailMock as unknown as MailQueueService,
    cacheMock as unknown as CacheService,
    i18nMock as unknown as I18nService,
  );

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(NOW);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    shopsRepository.existsBy.mockResolvedValue(false);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  describe('apply', () => {
    it('locks the owner, then stores a PENDING shop under a slug of its name', async () => {
      managerMock.existsBy.mockResolvedValue(false);

      await expect(service.apply(OWNER, INPUT)).resolves.toMatchObject({
        id: 'shop-1',
        slug: 'nha-sach-ha-noi',
        ownerId: OWNER.id,
        description: null,
        status: ShopStatus.Pending,
      });

      expect(managerMock.findOne).toHaveBeenCalledWith(User, {
        where: { id: OWNER.id },
        lock: { mode: 'pessimistic_write' },
      });
    });

    it('never gives a shop the slug of the "me" route', async () => {
      managerMock.existsBy.mockResolvedValue(false);

      await expect(
        service.apply(OWNER, { ...INPUT, name: 'Me' }),
      ).resolves.toMatchObject({ slug: 'me-2' });
    });

    it('refuses a second shop for the same owner', async () => {
      managerMock.existsBy.mockResolvedValue(true);

      await expect(service.apply(OWNER, INPUT)).rejects.toThrow(
        ConflictException,
      );
      expect(managerMock.save).not.toHaveBeenCalled();
    });
  });

  describe('updateMine', () => {
    it('applies only the fields sent', async () => {
      const shop = buildShop({ ownerId: OWNER.id });
      managerMock.findOne.mockResolvedValue(shop);
      managerMock.findOneByOrFail.mockResolvedValue(shop);

      await service.updateMine(OWNER, { phone: '0912345678' });

      expect(managerMock.update).toHaveBeenCalledWith(
        Shop,
        { id: shop.id },
        { phone: '0912345678' },
      );
      expect(cacheMock.invalidate).not.toHaveBeenCalled();
    });

    it('refreshes the cached product listings when the shop is renamed', async () => {
      const shop = buildShop({ ownerId: OWNER.id });
      managerMock.findOne.mockResolvedValue(shop);
      managerMock.findOneByOrFail.mockResolvedValue(shop);

      await service.updateMine(OWNER, { name: 'Nhà Sách Mới' });

      expect(cacheMock.invalidate).toHaveBeenCalledWith(
        CACHE_RESOURCES.products,
      );
    });

    it('sends a rejected shop back for review', async () => {
      const shop = pending({
        status: ShopStatus.Rejected,
        rejectionReason: 'Thiếu giấy phép kinh doanh',
        reviewedBy: ADMIN.id,
        reviewedAt: NOW,
      });
      managerMock.findOne.mockResolvedValue(shop);
      managerMock.findOneByOrFail.mockResolvedValue(shop);

      await service.updateMine(OWNER, { description: 'Đã bổ sung giấy phép' });

      expect(managerMock.update).toHaveBeenCalledWith(
        Shop,
        { id: shop.id },
        {
          description: 'Đã bổ sung giấy phép',
          status: ShopStatus.Pending,
          rejectionReason: null,
          reviewedBy: null,
          reviewedAt: null,
        },
      );
    });

    it('answers 404 to an account without a shop', async () => {
      managerMock.findOne.mockResolvedValue(null);

      await expect(
        service.updateMine(OWNER, { phone: '0912345678' }),
      ).rejects.toThrow(NotFoundException);
      expect(managerMock.update).not.toHaveBeenCalled();
    });
  });

  describe('review', () => {
    it('approves a pending shop and emails its owner after the commit', async () => {
      const approved = pending({
        status: ShopStatus.Active,
        reviewedBy: ADMIN.id,
        reviewedAt: NOW,
      });
      managerMock.findOne.mockResolvedValue(pending());
      managerMock.findOneByOrFail.mockResolvedValue(approved);

      await expect(
        service.review(ADMIN, approved.id, { status: ShopStatus.Active }),
      ).resolves.toEqual({ shop: approved, owner: OWNER });

      expect(managerMock.update).toHaveBeenCalledWith(
        Shop,
        { id: approved.id },
        {
          status: ShopStatus.Active,
          rejectionReason: null,
          reviewedBy: ADMIN.id,
          reviewedAt: NOW,
        },
      );
      expect(mailMock.enqueue).toHaveBeenCalledWith(MAIL_JOB.ShopReviewed, {
        to: OWNER.email,
        fullName: OWNER.fullName,
        shopName: approved.name,
        status: ShopStatus.Active,
        reason: null,
        lang: MAIL_FALLBACK_LANGUAGE,
      });
    });

    it('stores the reason of a rejection', async () => {
      const reason = 'Thiếu giấy phép kinh doanh';
      managerMock.findOne.mockResolvedValue(pending());
      managerMock.findOneByOrFail.mockResolvedValue(
        pending({ status: ShopStatus.Rejected, rejectionReason: reason }),
      );

      await service.review(ADMIN, 'shop-1', {
        status: ShopStatus.Rejected,
        reason,
      });

      expect(managerMock.update).toHaveBeenCalledWith(
        Shop,
        { id: 'shop-1' },
        expect.objectContaining({ rejectionReason: reason }),
      );
      expect(mailMock.enqueue).toHaveBeenCalledWith(
        MAIL_JOB.ShopReviewed,
        expect.objectContaining({ reason }),
      );
    });

    it('refuses a rejection without a reason', async () => {
      managerMock.findOne.mockResolvedValue(pending());

      await expect(
        service.review(ADMIN, 'shop-1', { status: ShopStatus.Rejected }),
      ).rejects.toThrow(UnprocessableEntityException);
      expect(managerMock.update).not.toHaveBeenCalled();
      expect(mailMock.enqueue).not.toHaveBeenCalled();
    });

    it.each([ShopStatus.Active, ShopStatus.Rejected])(
      'refuses to review a %s shop again',
      async (status) => {
        managerMock.findOne.mockResolvedValue(
          pending({ status, reviewedAt: NOW, rejectionReason: 'x'.repeat(10) }),
        );

        await expect(
          service.review(ADMIN, 'shop-1', { status: ShopStatus.Active }),
        ).rejects.toThrow(UnprocessableEntityException);
        expect(managerMock.update).not.toHaveBeenCalled();
        expect(mailMock.enqueue).not.toHaveBeenCalled();
      },
    );

    it('answers 404 to an unknown shop', async () => {
      managerMock.findOne.mockResolvedValue(null);

      await expect(
        service.review(ADMIN, 'missing', { status: ShopStatus.Active }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
