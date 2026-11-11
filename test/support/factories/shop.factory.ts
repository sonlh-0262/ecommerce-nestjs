import { DeepPartial, Repository } from 'typeorm';

import { Shop } from '../../../src/shops/entities/shop.entity';
import { ShopStatus } from '../../../src/shops/enums/shop-status.enum';
import { User } from '../../../src/users/entities/user.entity';
import { nextSequence } from './sequence';

export class ShopFactory {
  constructor(private readonly shops: Repository<Shop>) {}

  shop(owner: User, overrides: DeepPartial<Shop> = {}): Promise<Shop> {
    const sequence = nextSequence();

    return this.shops.save(
      this.shops.create({
        ownerId: owner.id,
        name: `Shop ${sequence}`,
        slug: `shop-${sequence}`,
        phone: '0901234567',
        address: '12 Hang Bai, Ha Noi',
        status: ShopStatus.Active,
        reviewedAt: new Date(),
        ...overrides,
      }),
    );
  }
}
