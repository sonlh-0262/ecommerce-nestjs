import { ExecutionContext } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';

import { buildShop } from '../entities/shop.fixture';
import { CurrentShop } from './current-shop.decorator';

type Factory = (data: unknown, context: ExecutionContext) => unknown;

function factoryOf(): Factory {
  class Probe {
    handler(@CurrentShop() _shop: unknown): void {}
  }

  const metadata = Reflect.getMetadata(
    ROUTE_ARGS_METADATA,
    Probe,
    'handler',
  ) as Record<string, { factory: Factory }>;

  return Object.values(metadata)[0].factory;
}

describe('CurrentShop', () => {
  const contextWith = (request: object) =>
    ({
      switchToHttp: () => ({ getRequest: () => request }),
    }) as unknown as ExecutionContext;

  it('reads the shop the guard put on the request', () => {
    const shop = buildShop();

    expect(factoryOf()(undefined, contextWith({ shop }))).toBe(shop);
  });

  it('fails loudly on a route without the seller guard', () => {
    expect(() => factoryOf()(undefined, contextWith({}))).toThrow(
      /@SellerOnly/,
    );
  });
});
