import { ApiProperty } from '@nestjs/swagger';

import { Shop } from '../entities/shop.entity';

export class ShopRefDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Nhà Sách Hà Nội' })
  name: string;

  @ApiProperty({ example: 'nha-sach-ha-noi' })
  slug: string;
}

export function toShopRef(shop: Shop | null): ShopRefDto | null {
  return shop ? { id: shop.id, name: shop.name, slug: shop.slug } : null;
}
