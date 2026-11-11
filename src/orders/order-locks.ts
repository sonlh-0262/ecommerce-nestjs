import { EntityManager } from 'typeorm';

import { Order } from './entities/order.entity';

export function findOwnedOrderForUpdate(
  manager: EntityManager,
  userId: string,
  code: string,
): Promise<Order | null> {
  return manager.findOne(Order, {
    where: { code, userId },
    lock: { mode: 'pessimistic_write' },
  });
}

export function findOrderForUpdate(
  manager: EntityManager,
  id: string,
): Promise<Order | null> {
  return manager.findOne(Order, {
    where: { id },
    lock: { mode: 'pessimistic_write' },
  });
}
