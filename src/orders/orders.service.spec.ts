import {
  ConflictException,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { I18nService } from 'nestjs-i18n';
import { EntityManager } from 'typeorm';

import { CartItem } from '../cart/entities/cart-item.entity';
import { CartService } from '../cart/cart.service';
import { transactionalDataSource } from '../database/transaction.fixture';
import { MAIL_JOB } from '../mail/mail.constants';
import { MailQueueService } from '../mail/mail-queue.service';
import { Product } from '../products/entities/product.entity';
import { ProductStatus } from '../products/enums/product-status.enum';
import { ProductsService } from '../products/products.service';
import { User } from '../users/entities/user.entity';
import { CreateOrderBodyDto } from './dto/create-order.dto';
import { OrderItem } from './entities/order-item.entity';
import { OrderStatusHistory } from './entities/order-status-history.entity';
import { Order } from './entities/order.entity';
import { OrderStatus } from './enums/order-status.enum';
import { PaymentMethod } from './enums/payment-method.enum';
import { PaymentStatus } from './enums/payment-status.enum';
import { OrderCodeService } from './order-code.service';
import { OrdersViewService } from './orders-view.service';
import { OrdersService } from './orders.service';

describe('OrdersService', () => {
  const SHIPPING_FEE = 30000;
  const CODE = 'ORD-20261005-0001';
  const USER = {
    id: 'u1',
    email: 'son@example.com',
    fullName: 'Lanh Hung Son',
  } as User;

  const product = (overrides: Partial<Product> = {}): Product =>
    ({
      id: 'p1',
      name: 'Áo thun',
      slug: 'ao-thun',
      price: 150000,
      salePrice: null,
      stock: 10,
      status: ProductStatus.Published,
      deletedAt: null,
      ...overrides,
    }) as Product;

  const cartItem = (productId: string, quantity: number): CartItem =>
    ({ id: `ci-${productId}`, cartId: 'c1', productId, quantity }) as CartItem;

  const order = (overrides: Partial<Order> = {}): Order =>
    ({
      id: 'o1',
      code: CODE,
      userId: USER.id,
      status: OrderStatus.Pending,
      paymentMethod: PaymentMethod.BankTransfer,
      paymentStatus: PaymentStatus.Unpaid,
      shippingAddress: '1 Nguyen Trai, Ha Noi',
      ...overrides,
    }) as Order;

  const input: CreateOrderBodyDto = {
    receiverName: 'Lanh Hung Son',
    receiverPhone: '0901234567',
    shippingAddress: '1 Nguyen Trai, Ha Noi',
    paymentMethod: PaymentMethod.Cod,
  };

  const managerMock = {
    create: jest.fn((_entity: unknown, value: Partial<Order>) => value),
    save: jest.fn((value: Partial<Order>) =>
      Promise.resolve({ id: 'o1', ...value } as Order),
    ),
    insert: jest.fn(),
    update: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
  };
  const manager = managerMock as unknown as EntityManager;
  const { dataSource, transaction } = transactionalDataSource(manager);
  const cartMock = { lockItems: jest.fn(), removeItems: jest.fn() };
  const productsMock = {
    lockForSale: jest.fn(),
    recordSale: jest.fn(),
    restock: jest.fn(),
  };
  const codesMock = { next: jest.fn() };
  const viewMock = {
    detailOf: jest.fn((value: Order) => Promise.resolve({ order: value })),
  };
  const mailMock = { enqueue: jest.fn() };
  const i18nMock = { t: jest.fn((key: string) => key) };

  const service = new OrdersService(
    dataSource,
    cartMock as unknown as CartService,
    productsMock as unknown as ProductsService,
    codesMock as unknown as OrderCodeService,
    viewMock as unknown as OrdersViewService,
    mailMock as unknown as MailQueueService,
    i18nMock as unknown as I18nService,
    {
      getOrThrow: () => ({ shippingFee: SHIPPING_FEE }),
    } as unknown as ConfigService,
  );

  const caught = async (promise: Promise<unknown>) =>
    (await promise.catch((error: unknown) => error)) as ConflictException;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    codesMock.next.mockResolvedValue(CODE);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  describe('checkout', () => {
    beforeEach(() => {
      cartMock.lockItems.mockResolvedValue([
        cartItem('p1', 2),
        cartItem('p2', 1),
      ]);
      productsMock.lockForSale.mockResolvedValue([
        product(),
        product({ id: 'p2', name: 'Mũ', price: 50000, salePrice: 45000 }),
      ]);
    });

    it('answers 422 for an empty cart', async () => {
      cartMock.lockItems.mockResolvedValue([]);

      await expect(service.checkout(USER, input)).rejects.toThrow(
        new UnprocessableEntityException('cart.EMPTY'),
      );
      expect(productsMock.lockForSale).not.toHaveBeenCalled();
    });

    it('locks the products of every cart item', async () => {
      await service.checkout(USER, input);

      expect(cartMock.lockItems).toHaveBeenCalledWith(managerMock, USER.id);
      expect(productsMock.lockForSale).toHaveBeenCalledWith(managerMock, [
        'p1',
        'p2',
      ]);
    });

    it('answers 409 with every item it cannot sell, and writes nothing', async () => {
      productsMock.lockForSale.mockResolvedValue([
        product({ stock: 1 }),
        product({ id: 'p2', name: 'Mũ', status: ProductStatus.Archived }),
      ]);

      const error = await caught(service.checkout(USER, input));

      expect(error).toBeInstanceOf(ConflictException);
      expect(error.getResponse()).toEqual({
        message: 'orders.ITEMS_UNAVAILABLE',
        details: {
          items: [
            {
              productId: 'p1',
              name: 'Áo thun',
              reason: 'OUT_OF_STOCK',
              availableStock: 1,
            },
            {
              productId: 'p2',
              name: 'Mũ',
              reason: 'UNAVAILABLE',
              availableStock: 0,
            },
          ],
        },
      });
      expect(managerMock.save).not.toHaveBeenCalled();
      expect(productsMock.recordSale).not.toHaveBeenCalled();
      expect(mailMock.enqueue).not.toHaveBeenCalled();
    });

    it('creates a pending, unpaid order priced from the locked products', async () => {
      await service.checkout(USER, { ...input, note: undefined });

      expect(managerMock.create).toHaveBeenCalledWith(
        Order,
        expect.objectContaining({
          code: CODE,
          userId: USER.id,
          note: null,
          status: OrderStatus.Pending,
          paymentStatus: PaymentStatus.Unpaid,
          subtotal: 345000,
          shippingFee: SHIPPING_FEE,
          total: 375000,
        }),
      );
    });

    it('snapshots the name, slug and price of every line', async () => {
      await service.checkout(USER, input);

      expect(managerMock.insert).toHaveBeenCalledWith(OrderItem, [
        {
          orderId: 'o1',
          productId: 'p1',
          productName: 'Áo thun',
          productSlug: 'ao-thun',
          unitPrice: 150000,
          quantity: 2,
          lineTotal: 300000,
        },
        expect.objectContaining({
          productId: 'p2',
          unitPrice: 45000,
          lineTotal: 45000,
        }),
      ]);
    });

    it('takes the stock, records the history and empties the cart', async () => {
      await service.checkout(USER, input);

      expect(productsMock.recordSale).toHaveBeenCalledWith(
        managerMock,
        'p1',
        2,
      );
      expect(productsMock.recordSale).toHaveBeenCalledWith(
        managerMock,
        'p2',
        1,
      );
      expect(managerMock.insert).toHaveBeenCalledWith(OrderStatusHistory, {
        orderId: 'o1',
        fromStatus: null,
        toStatus: OrderStatus.Pending,
        changedBy: USER.id,
      });
      expect(cartMock.removeItems).toHaveBeenCalledWith(managerMock, [
        cartItem('p1', 2),
        cartItem('p2', 1),
      ]);
    });

    it('queues the confirmation mail only after the transaction commits', async () => {
      let queuedBeforeCommit: number | undefined;

      transaction.mockImplementationOnce(
        async (work: (manager: EntityManager) => Promise<unknown>) => {
          const result = await work(manager);

          queuedBeforeCommit = mailMock.enqueue.mock.calls.length;

          return result;
        },
      );

      await service.checkout(USER, input);

      expect(queuedBeforeCommit).toBe(0);

      expect(mailMock.enqueue).toHaveBeenCalledWith(MAIL_JOB.OrderCreated, {
        to: USER.email,
        fullName: USER.fullName,
        orderCode: CODE,
        items: [
          { name: 'Áo thun', quantity: 2, lineTotal: 300000 },
          { name: 'Mũ', quantity: 1, lineTotal: 45000 },
        ],
        subtotal: 345000,
        shippingFee: SHIPPING_FEE,
        total: 375000,
        shippingAddress: input.shippingAddress,
      });
    });

    it('queues no mail when the transaction fails', async () => {
      codesMock.next.mockRejectedValue(
        new ConflictException('orders.CODE_SEQUENCE_EXHAUSTED'),
      );

      await expect(service.checkout(USER, input)).rejects.toThrow(
        ConflictException,
      );
      expect(mailMock.enqueue).not.toHaveBeenCalled();
    });

    it('returns the full detail of the new order', async () => {
      await service.checkout(USER, input);

      expect(viewMock.detailOf).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'o1', code: CODE }),
      );
    });
  });

  describe('pay', () => {
    const pay = () => service.pay(USER, CODE, { transactionRef: 'FT123' });

    it('locks my order by code', async () => {
      managerMock.findOne.mockResolvedValue(order());

      await pay();

      expect(managerMock.findOne).toHaveBeenCalledWith(Order, {
        where: { code: CODE, userId: USER.id },
        lock: { mode: 'pessimistic_write' },
      });
    });

    it('records the reference and marks the order paid', async () => {
      managerMock.findOne.mockResolvedValue(order());

      await pay();

      expect(managerMock.update).toHaveBeenCalledWith(
        Order,
        { id: 'o1' },
        {
          paymentTransactionRef: 'FT123',
          paymentStatus: PaymentStatus.Paid,
          paidAt: expect.any(Date) as Date,
        },
      );
      expect(viewMock.detailOf).toHaveBeenCalledWith(
        expect.objectContaining({ paymentStatus: PaymentStatus.Paid }),
      );
    });

    it("answers 404 for someone else's order", async () => {
      managerMock.findOne.mockResolvedValue(null);

      await expect(pay()).rejects.toThrow(
        new NotFoundException('orders.NOT_FOUND'),
      );
    });

    it('answers 422 for a cash on delivery order', async () => {
      managerMock.findOne.mockResolvedValue(
        order({ paymentMethod: PaymentMethod.Cod }),
      );

      await expect(pay()).rejects.toThrow(
        new UnprocessableEntityException('orders.PAYMENT_NOT_APPLICABLE'),
      );
    });

    it('answers 409 for an order already paid', async () => {
      managerMock.findOne.mockResolvedValue(
        order({ paymentStatus: PaymentStatus.Paid }),
      );

      await expect(pay()).rejects.toThrow(
        new ConflictException('orders.ALREADY_PAID'),
      );
    });

    it.each([OrderStatus.Cancelled, OrderStatus.Delivered])(
      'answers 422 for a %s order',
      async (status) => {
        managerMock.findOne.mockResolvedValue(order({ status }));

        await expect(pay()).rejects.toThrow(
          new UnprocessableEntityException('orders.INVALID_STATE'),
        );
        expect(managerMock.update).not.toHaveBeenCalled();
      },
    );

    it('accepts a confirmed order', async () => {
      managerMock.findOne.mockResolvedValue(
        order({ status: OrderStatus.Confirmed }),
      );

      await expect(pay()).resolves.toBeDefined();
    });
  });

  describe('cancel', () => {
    beforeEach(() => {
      managerMock.find.mockResolvedValue([
        { productId: 'p1', quantity: 2 },
        { productId: 'p2', quantity: 1 },
      ]);
    });

    it('puts every quantity back, in product order to avoid deadlocks', async () => {
      managerMock.findOne.mockResolvedValue(order());

      await service.cancel(USER, CODE);

      expect(managerMock.find).toHaveBeenCalledWith(OrderItem, {
        where: { orderId: 'o1' },
        order: { productId: 'ASC' },
      });
      expect(productsMock.restock.mock.calls).toEqual([
        [managerMock, 'p1', 2],
        [managerMock, 'p2', 1],
      ]);
    });

    it('cancels with the reason and records the change', async () => {
      managerMock.findOne.mockResolvedValue(order());

      await service.cancel(USER, CODE, { reason: 'Wrong size' });

      expect(managerMock.update).toHaveBeenCalledWith(
        Order,
        { id: 'o1' },
        { status: OrderStatus.Cancelled, reason: 'Wrong size' },
      );
      expect(managerMock.insert).toHaveBeenCalledWith(OrderStatusHistory, {
        orderId: 'o1',
        fromStatus: OrderStatus.Pending,
        toStatus: OrderStatus.Cancelled,
        reason: 'Wrong size',
        changedBy: USER.id,
      });
    });

    it('cancels without a reason', async () => {
      managerMock.findOne.mockResolvedValue(order());

      await service.cancel(USER, CODE);

      expect(managerMock.update).toHaveBeenCalledWith(
        Order,
        { id: 'o1' },
        { status: OrderStatus.Cancelled, reason: null },
      );
    });

    it.each([OrderStatus.Confirmed, OrderStatus.Cancelled])(
      'answers 422 for a %s order and restores nothing',
      async (status) => {
        managerMock.findOne.mockResolvedValue(order({ status }));

        await expect(service.cancel(USER, CODE)).rejects.toThrow(
          new UnprocessableEntityException('orders.CANNOT_CANCEL'),
        );
        expect(productsMock.restock).not.toHaveBeenCalled();
      },
    );

    it("answers 404 for someone else's order", async () => {
      managerMock.findOne.mockResolvedValue(null);

      await expect(service.cancel(USER, CODE)).rejects.toThrow(
        new NotFoundException('orders.NOT_FOUND'),
      );
    });
  });
});
