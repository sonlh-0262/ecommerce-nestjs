import { ExecutionContext, ForbiddenException } from '@nestjs/common';

import { buildShop } from '../entities/shop.fixture';
import { ShopRequest } from '../interfaces/shop-request.interface';
import { ShopsViewService } from '../shops-view.service';
import { ShopOwnerGuard } from './shop-owner.guard';

describe('ShopOwnerGuard', () => {
  const shopsMock = { activeShopOf: jest.fn() };
  const guard = new ShopOwnerGuard(shopsMock as unknown as ShopsViewService);

  const contextFor = (request: ShopRequest & { user: object }) =>
    ({
      getType: () => 'http',
      switchToHttp: () => ({ getRequest: () => request }),
    }) as unknown as ExecutionContext;

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('puts the active shop of the caller on the request', async () => {
    const shop = buildShop();
    const request = { user: { user: { id: 'u1' } } };
    shopsMock.activeShopOf.mockResolvedValue(shop);

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);

    expect(shopsMock.activeShopOf).toHaveBeenCalledWith('u1');
    expect((request as ShopRequest).shop).toBe(shop);
  });

  it('lets the refusal of a caller without an active shop through', async () => {
    shopsMock.activeShopOf.mockRejectedValue(
      new ForbiddenException('shops.SHOP_REQUIRED'),
    );

    await expect(
      guard.canActivate(contextFor({ user: { user: { id: 'u2' } } })),
    ).rejects.toThrow(ForbiddenException);
  });
});
