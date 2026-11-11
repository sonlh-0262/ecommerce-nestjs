import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { I18nService } from 'nestjs-i18n';
import { Brackets, FindOptionsWhere, In, Repository } from 'typeorm';

import { containsPattern } from '../common/helpers/escape-like';
import { UserRef } from '../users/dto/user-ref.dto';
import { User } from '../users/entities/user.entity';
import { loadUserRefs } from '../users/user-refs';
import { AdminShopsQueryDto } from './dto/admin-shops-query.dto';
import { Shop } from './entities/shop.entity';
import { ShopStatus } from './enums/shop-status.enum';
import { AdminShopPage, AdminShopView } from './interfaces/shop-view.interface';

export function shopIn(
  shops: Map<string, Shop>,
  shopId: string | null,
): Shop | null {
  return shopId ? (shops.get(shopId) ?? null) : null;
}

@Injectable()
export class ShopsViewService {
  constructor(
    @InjectRepository(Shop)
    private readonly shopsRepository: Repository<Shop>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly i18n: I18nService,
  ) {}

  findMine(ownerId: string): Promise<Shop> {
    return this.findOrFail({ ownerId });
  }

  findPublic(slug: string): Promise<Shop> {
    return this.findOrFail({ slug, status: ShopStatus.Active });
  }

  async activeShopOf(ownerId: string): Promise<Shop> {
    const shop = await this.shopsRepository.findOneBy({
      ownerId,
      status: ShopStatus.Active,
    });

    if (!shop) {
      throw new ForbiddenException(this.i18n.t('shops.SHOP_REQUIRED'));
    }

    return shop;
  }

  async byIds(ids: (string | null)[]): Promise<Map<string, Shop>> {
    const unique = [...new Set(ids.filter((id): id is string => id !== null))];

    if (unique.length === 0) {
      return new Map();
    }

    const shops = await this.shopsRepository.findBy({ id: In(unique) });

    return new Map(shops.map((shop) => [shop.id, shop]));
  }

  async adminList(query: AdminShopsQueryDto): Promise<AdminShopPage> {
    const builder = this.shopsRepository
      .createQueryBuilder('shop')
      .orderBy('shop.createdAt', 'DESC')
      .addOrderBy('shop.id', 'DESC')
      .offset(query.offset)
      .limit(query.limit);

    if (query.status) {
      builder.andWhere('shop.status = :status', { status: query.status });
    }

    if (query.q) {
      builder.andWhere(
        new Brackets((match) =>
          match
            .where('shop.name ILIKE :pattern')
            .orWhere('shop.slug ILIKE :pattern'),
        ),
        { pattern: containsPattern(query.q) },
      );
    }

    const [shops, total] = await builder.getManyAndCount();
    const owners = await this.ownersOf(shops);

    return {
      shops: shops.map((shop) => ({
        shop,
        owner: owners.get(shop.ownerId) as UserRef,
      })),
      total,
    };
  }

  async adminViewOf(shop: Shop): Promise<AdminShopView> {
    const owners = await this.ownersOf([shop]);

    return { shop, owner: owners.get(shop.ownerId) as UserRef };
  }

  private async findOrFail(where: FindOptionsWhere<Shop>): Promise<Shop> {
    const shop = await this.shopsRepository.findOneBy(where);

    if (!shop) {
      throw new NotFoundException(this.i18n.t('shops.NOT_FOUND'));
    }

    return shop;
  }

  private ownersOf(shops: Shop[]): Promise<Map<string, UserRef>> {
    return loadUserRefs(
      this.usersRepository,
      shops.map(({ ownerId }) => ownerId),
    );
  }
}
