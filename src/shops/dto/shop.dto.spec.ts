import { buildShop } from '../entities/shop.fixture';
import { ShopStatus } from '../enums/shop-status.enum';
import {
  toAdminShopResponse,
  toAdminShopsResponse,
  toPublicShopResponse,
  toShopResponse,
} from './shop.dto';

describe('shop mappers', () => {
  const OWNER = {
    id: 'u1',
    email: 'son@example.com',
    username: 'sonlh',
    fullName: 'Lanh Hung Son',
  };
  const shop = buildShop({
    status: ShopStatus.Rejected,
    rejectionReason: 'Thiếu giấy phép kinh doanh',
  });

  const PUBLIC = {
    id: shop.id,
    name: shop.name,
    slug: shop.slug,
    description: shop.description,
    createdAt: '2026-11-05T02:00:00.000Z',
  };
  const OWN = {
    ...PUBLIC,
    phone: shop.phone,
    address: shop.address,
    status: ShopStatus.Rejected,
    rejectionReason: 'Thiếu giấy phép kinh doanh',
    reviewedAt: '2026-11-05T03:00:00.000Z',
    updatedAt: '2026-11-05T03:00:00.000Z',
  };

  it('shows the public no contact details and no review', () => {
    expect(toPublicShopResponse(shop)).toEqual({ shop: PUBLIC });
  });

  it('shows the owner its review and contact details', () => {
    expect(toShopResponse(shop)).toEqual({ shop: OWN });
  });

  it('adds the owner and the reviewer for an admin', () => {
    const view = { shop, owner: OWNER };

    expect(toAdminShopResponse(view)).toEqual({
      shop: { ...OWN, owner: OWNER, reviewedBy: 'a1' },
    });
    expect(toAdminShopsResponse({ shops: [view], total: 4 })).toMatchObject({
      shopsCount: 4,
    });
  });

  it('reports a pending shop as not reviewed', () => {
    expect(
      toShopResponse(buildShop({ reviewedAt: null })).shop.reviewedAt,
    ).toBeNull();
  });
});
