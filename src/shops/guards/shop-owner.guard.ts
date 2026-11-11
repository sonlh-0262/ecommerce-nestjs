import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

import { authenticatedUser } from '../../common/decorators/authenticated-user';
import { ShopRequest } from '../interfaces/shop-request.interface';
import { ShopsViewService } from '../shops-view.service';

@Injectable()
export class ShopOwnerGuard implements CanActivate {
  constructor(private readonly shops: ShopsViewService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<ShopRequest>();

    request.shop = await this.shops.activeShopOf(
      authenticatedUser(context).user.id,
    );

    return true;
  }
}
