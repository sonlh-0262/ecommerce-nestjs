import { EntityManager } from 'typeorm';

import { ProductsService } from '../products/products.service';
import { OrderItem } from './entities/order-item.entity';
import { OrderStatusHistory } from './entities/order-status-history.entity';
import { Order } from './entities/order.entity';
import { OrderStatus } from './enums/order-status.enum';
import { OrderTransitionsService } from './order-transitions.service';

describe('OrderTransitionsService', () => {
  const ADMIN_ID = 'a1';

  const managerMock = {
    find: jest.fn(),
    update: jest.fn(),
    insert: jest.fn(),
  };
  const manager = managerMock as unknown as EntityManager;
  const productsMock = { restock: jest.fn() };

  const service = new OrderTransitionsService(
    productsMock as unknown as ProductsService,
  );

  const order = (status = OrderStatus.Pending): Order =>
    ({ id: 'o1', status }) as Order;

  beforeEach(() => {
    managerMock.find.mockResolvedValue([
      { productId: 'p1', quantity: 2 },
      { productId: 'p2', quantity: 1 },
    ]);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it.each([OrderStatus.Cancelled, OrderStatus.Rejected])(
    'puts every quantity back on %s, in product order to avoid deadlocks',
    async (to) => {
      await service.apply(manager, order(), { to, changedBy: ADMIN_ID });

      expect(managerMock.find).toHaveBeenCalledWith(OrderItem, {
        where: { orderId: 'o1' },
        order: { productId: 'ASC' },
      });
      expect(productsMock.restock.mock.calls).toEqual([
        [manager, 'p1', 2],
        [manager, 'p2', 1],
      ]);
    },
  );

  it.each([OrderStatus.Confirmed, OrderStatus.Shipping, OrderStatus.Delivered])(
    'leaves the stock alone on %s',
    async (to) => {
      await service.apply(manager, order(), { to, changedBy: ADMIN_ID });

      expect(managerMock.find).not.toHaveBeenCalled();
      expect(productsMock.restock).not.toHaveBeenCalled();
    },
  );

  it('writes the status with the patch and records who changed it', async () => {
    const deliveredAt = new Date('2026-10-15T03:00:00.000Z');

    const result = await service.apply(manager, order(OrderStatus.Shipping), {
      to: OrderStatus.Delivered,
      changedBy: ADMIN_ID,
      reason: 'Left with the doorman',
      patch: { deliveredAt },
    });

    expect(managerMock.update).toHaveBeenCalledWith(
      Order,
      { id: 'o1' },
      { deliveredAt, status: OrderStatus.Delivered },
    );
    expect(managerMock.insert).toHaveBeenCalledWith(OrderStatusHistory, {
      orderId: 'o1',
      fromStatus: OrderStatus.Shipping,
      toStatus: OrderStatus.Delivered,
      reason: 'Left with the doorman',
      changedBy: ADMIN_ID,
    });
    expect(result).toEqual({
      id: 'o1',
      status: OrderStatus.Delivered,
      deliveredAt,
    });
  });

  it('records no reason when none is given', async () => {
    await service.apply(manager, order(), {
      to: OrderStatus.Confirmed,
      changedBy: ADMIN_ID,
    });

    expect(managerMock.update).toHaveBeenCalledWith(
      Order,
      { id: 'o1' },
      { status: OrderStatus.Confirmed },
    );
    expect(managerMock.insert).toHaveBeenCalledWith(
      OrderStatusHistory,
      expect.objectContaining({ reason: null }),
    );
  });
});
