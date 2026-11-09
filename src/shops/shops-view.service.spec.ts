import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { In, Repository } from 'typeorm';

import { User } from '../users/entities/user.entity';
import { buildShop } from './entities/shop.fixture';
import { Shop } from './entities/shop.entity';
import { ShopStatus } from './enums/shop-status.enum';
import { ShopsViewService, shopIn } from './shops-view.service';

describe('ShopsViewService', () => {
  const OWNERS = [
    { id: 'u1', email: 'an@example.com', username: 'an', fullName: 'An' },
    { id: 'u2', email: 'binh@example.com', username: 'binh', fullName: null },
  ];

  const builder = {
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(),
  };
  const shopsRepository = {
    findOneBy: jest.fn(),
    findBy: jest.fn(),
    createQueryBuilder: jest.fn(() => builder),
  };
  const usersRepository = { find: jest.fn() };

  const service = new ShopsViewService(
    shopsRepository as unknown as Repository<Shop>,
    usersRepository as unknown as Repository<User>,
    { t: (key: string) => key } as unknown as I18nService,
  );

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('finds the shop of an owner whatever its status', async () => {
    const shop = buildShop({ status: ShopStatus.Pending });
    shopsRepository.findOneBy.mockResolvedValue(shop);

    await expect(service.findMine('u1')).resolves.toBe(shop);
    expect(shopsRepository.findOneBy).toHaveBeenCalledWith({ ownerId: 'u1' });
  });

  it('shows the public only an active shop', async () => {
    shopsRepository.findOneBy.mockResolvedValue(null);

    await expect(service.findPublic('nha-sach')).rejects.toThrow(
      NotFoundException,
    );
    expect(shopsRepository.findOneBy).toHaveBeenCalledWith({
      slug: 'nha-sach',
      status: ShopStatus.Active,
    });
  });

  it('finds the active shop of an owner', async () => {
    const shop = buildShop();
    shopsRepository.findOneBy.mockResolvedValue(shop);

    await expect(service.activeShopOf('u1')).resolves.toBe(shop);
    expect(shopsRepository.findOneBy).toHaveBeenCalledWith({
      ownerId: 'u1',
      status: ShopStatus.Active,
    });
  });

  it('refuses an account whose shop is missing or not approved', async () => {
    shopsRepository.findOneBy.mockResolvedValue(null);

    await expect(service.activeShopOf('u1')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('loads several shops in one query, ignoring platform ids', async () => {
    const shop = buildShop();
    shopsRepository.findBy.mockResolvedValue([shop]);

    const shops = await service.byIds([shop.id, null, shop.id]);

    expect(shopsRepository.findBy).toHaveBeenCalledWith({ id: In([shop.id]) });
    expect(shopIn(shops, shop.id)).toBe(shop);
    expect(shopIn(shops, null)).toBeNull();
  });

  it('skips the shop query when there is no shop id', async () => {
    await expect(service.byIds([null, null])).resolves.toEqual(new Map());
    expect(shopsRepository.findBy).not.toHaveBeenCalled();
  });

  it('pages the admin list and loads every owner in one query', async () => {
    const shops = [
      buildShop({ id: 's1', ownerId: 'u1' }),
      buildShop({ id: 's2', ownerId: 'u2' }),
      buildShop({ id: 's3', ownerId: 'u1' }),
    ];
    builder.getManyAndCount.mockResolvedValue([shops, 9]);
    usersRepository.find.mockResolvedValue(OWNERS);

    const page = await service.adminList({
      limit: 20,
      offset: 40,
      status: ShopStatus.Pending,
      q: 'sach_',
    });

    expect(page.total).toBe(9);
    expect(page.shops.map(({ owner }) => owner.id)).toEqual(['u1', 'u2', 'u1']);
    expect(builder.offset).toHaveBeenCalledWith(40);
    expect(builder.andWhere).toHaveBeenCalledWith('shop.status = :status', {
      status: ShopStatus.Pending,
    });
    expect(builder.andWhere).toHaveBeenCalledWith(expect.anything(), {
      pattern: '%sach\\_%',
    });
    expect(usersRepository.find).toHaveBeenCalledWith({
      where: { id: In(['u1', 'u2']) },
      select: { id: true, email: true, username: true, fullName: true },
      withDeleted: true,
    });
  });

  it('skips the owner query for an empty page', async () => {
    builder.getManyAndCount.mockResolvedValue([[], 0]);

    await expect(service.adminList({ limit: 20, offset: 0 })).resolves.toEqual({
      shops: [],
      total: 0,
    });
    expect(builder.andWhere).not.toHaveBeenCalled();
    expect(usersRepository.find).not.toHaveBeenCalled();
  });
});
