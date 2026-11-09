import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import { Shop } from '../entities/shop.entity';
import { ShopRequest } from '../interfaces/shop-request.interface';

export const CurrentShop = createParamDecorator(
  (_data: unknown, context: ExecutionContext): Shop => {
    const { shop } = context.switchToHttp().getRequest<ShopRequest>();

    if (!shop) {
      throw new Error(
        'No shop on the request. Add @SellerOnly() to this route.',
      );
    }

    return shop;
  },
);
