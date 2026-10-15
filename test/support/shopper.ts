import request from 'supertest';

import { OrderDto, OrderResponseDto } from '../../src/orders/dto/order.dto';
import { OrderStatus } from '../../src/orders/enums/order-status.enum';
import { PaymentMethod } from '../../src/orders/enums/payment-method.enum';
import { Product } from '../../src/products/entities/product.entity';
import { bearer } from './http';
import { SeededUser } from './interfaces/seeded-user.interface';
import { TestContext } from './interfaces/test-context.interface';
import { ADMIN_ORDERS_PATH, CART_PATHS, ORDERS_PATH } from './test.constants';

type Method = 'get' | 'post' | 'patch' | 'delete';

export const DELIVERY_PATH: readonly OrderStatus[] = [
  OrderStatus.Confirmed,
  OrderStatus.Shipping,
  OrderStatus.Delivered,
];

export function actingAs(ctx: TestContext, { session }: SeededUser) {
  const call = (method: Method) => (url: string) =>
    request(ctx.server())
      [method](url)
      .set(...bearer(session.token));

  return {
    get: call('get'),
    post: call('post'),
    patch: call('patch'),
    delete: call('delete'),
  };
}

export async function placeOrder(
  ctx: TestContext,
  buyer: SeededUser,
  lines: [Product, number][],
  paymentMethod: PaymentMethod = PaymentMethod.Cod,
): Promise<OrderDto> {
  const as = actingAs(ctx, buyer);

  for (const [product, quantity] of lines) {
    await as
      .post(CART_PATHS.items)
      .send({ item: { productId: product.id, quantity } })
      .expect(201);
  }

  const response = await as
    .post(ORDERS_PATH)
    .send({
      order: {
        receiverName: 'Lanh Hung Son',
        receiverPhone: '0901234567',
        shippingAddress: '1 Nguyen Trai, Ha Noi',
        paymentMethod,
      },
    })
    .expect(201);

  return (response.body as OrderResponseDto).order;
}

export function changeStatus(
  ctx: TestContext,
  admin: SeededUser,
  code: string,
  order: { status: string; reason?: string | null },
) {
  return actingAs(ctx, admin)
    .patch(`${ADMIN_ORDERS_PATH}/${code}/status`)
    .send({ order });
}

export async function deliver(
  ctx: TestContext,
  admin: SeededUser,
  code: string,
): Promise<void> {
  for (const status of DELIVERY_PATH) {
    await changeStatus(ctx, admin, code, { status }).expect(200);
  }
}
