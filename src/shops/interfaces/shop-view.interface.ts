import { UserRef } from '../../users/dto/user-ref.dto';
import { Shop } from '../entities/shop.entity';

export interface AdminShopView {
  shop: Shop;
  owner: UserRef;
}

export interface AdminShopPage {
  shops: AdminShopView[];
  total: number;
}
