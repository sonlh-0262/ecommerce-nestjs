import { ShopStatus } from '../enums/shop-status.enum';
import { Shop } from './shop.entity';

export function buildShop(overrides: Partial<Shop> = {}): Shop {
  return {
    id: '5b0f5e1a-0000-4000-8000-000000000001',
    ownerId: '0d3d3f4e-0000-4000-8000-000000000001',
    name: 'Nhà Sách Hà Nội',
    slug: 'nha-sach-ha-noi',
    description: 'Sách giáo khoa và văn phòng phẩm.',
    phone: '0901234567',
    address: '12 Hang Bai, Ha Noi',
    status: ShopStatus.Active,
    rejectionReason: null,
    reviewedBy: 'a1',
    reviewedAt: new Date('2026-11-05T03:00:00.000Z'),
    createdAt: new Date('2026-11-05T02:00:00.000Z'),
    updatedAt: new Date('2026-11-05T03:00:00.000Z'),
    ...overrides,
  } as Shop;
}
