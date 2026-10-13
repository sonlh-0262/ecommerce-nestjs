import {
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { EntityManager, In, Repository } from 'typeorm';

import { transactionalDataSource } from '../database/transaction.fixture';
import { Product } from '../products/entities/product.entity';
import { ProductStatus } from '../products/enums/product-status.enum';
import { ProductThumbnailsService } from '../products/product-thumbnails.service';
import { CART_ITEM_MAX_QUANTITY } from './cart.constants';
import { CartService } from './cart.service';
import { CartItem } from './entities/cart-item.entity';
import { Cart } from './entities/cart.entity';

describe('CartService', () => {
  const USER_ID = 'user-1';
  const CART = { id: 'cart-1', userId: USER_ID } as Cart;

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

  const item = (overrides: Partial<CartItem> = {}): CartItem =>
    ({
      id: 'i1',
      cartId: CART.id,
      productId: 'p1',
      quantity: 2,
      product: product(),
      ...overrides,
    }) as CartItem;

  const viewBuilder = {
    innerJoin: jest.fn().mockReturnThis(),
    innerJoinAndSelect: jest.fn().mockReturnThis(),
    withDeleted: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    getMany: jest.fn(),
  };
  const insertBuilder = {
    insert: jest.fn().mockReturnThis(),
    into: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    orIgnore: jest.fn().mockReturnThis(),
    execute: jest.fn(),
  };
  const itemsRepository = {
    createQueryBuilder: jest.fn(() => viewBuilder),
  };
  const managerMock = {
    findOne: jest.fn(),
    findOneOrFail: jest.fn(),
    findOneBy: jest.fn(),
    find: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(() => insertBuilder),
  };
  const manager = managerMock as unknown as EntityManager;
  const { dataSource } = transactionalDataSource(manager);
  const thumbnailsMock = { urlsOf: jest.fn() };
  const i18nMock = {
    t: jest.fn(
      (key: string, options?: { args?: object }) =>
        `${key}${options?.args ? JSON.stringify(options.args) : ''}`,
    ),
  };

  const service = new CartService(
    itemsRepository as unknown as Repository<CartItem>,
    dataSource,
    thumbnailsMock as unknown as ProductThumbnailsService,
    i18nMock as unknown as I18nService,
  );

  const caught = async (promise: Promise<unknown>) =>
    (await promise.catch((error: unknown) => error)) as ConflictException;

  const findProduct = (found: Product | null) =>
    managerMock.findOneBy.mockImplementation((entity: unknown) =>
      Promise.resolve(entity === Product ? found : null),
    );

  beforeEach(() => {
    viewBuilder.getMany.mockResolvedValue([]);
    thumbnailsMock.urlsOf.mockResolvedValue(new Map());
    managerMock.findOne.mockResolvedValue(CART);
    managerMock.findOneOrFail.mockResolvedValue(CART);
    findProduct(product());
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('view', () => {
    it('loads the items with their products, then the thumbnails in one batch', async () => {
      viewBuilder.getMany.mockResolvedValue([item()]);

      await service.view(USER_ID);

      expect(viewBuilder.getMany).toHaveBeenCalledTimes(1);
      expect(viewBuilder.where).toHaveBeenCalledWith('cart.userId = :userId', {
        userId: USER_ID,
      });
      expect(thumbnailsMock.urlsOf).toHaveBeenCalledTimes(1);
      expect(thumbnailsMock.urlsOf).toHaveBeenCalledWith(['p1']);
    });

    it('prices each line at the current price, sale price first', async () => {
      viewBuilder.getMany.mockResolvedValue([
        item({ product: product({ salePrice: 120000 }) }),
      ]);
      thumbnailsMock.urlsOf.mockResolvedValue(new Map([['p1', '/thumb']]));

      const { lines, subtotal } = await service.view(USER_ID);

      expect(lines[0]).toMatchObject({
        unitPrice: 120000,
        lineTotal: 240000,
        thumbnailUrl: '/thumb',
        available: true,
      });
      expect(subtotal).toBe(240000);
    });

    it.each([
      ['no longer published', { status: ProductStatus.Draft }],
      ['deleted', { status: ProductStatus.Archived, deletedAt: new Date() }],
      ['below the quantity in stock', { stock: 1 }],
    ])(
      'flags an item whose product is %s and leaves it out of the subtotal',
      async (_case, overrides: Partial<Product>) => {
        viewBuilder.getMany.mockResolvedValue([
          item(),
          item({
            id: 'i2',
            productId: 'p2',
            product: product({ id: 'p2', ...overrides }),
          }),
        ]);

        const { lines, subtotal } = await service.view(USER_ID);

        expect(lines.map(({ available }) => available)).toEqual([true, false]);
        expect(subtotal).toBe(300000);
      },
    );

    it('is empty without a cart', async () => {
      await expect(service.view(USER_ID)).resolves.toEqual({
        lines: [],
        subtotal: 0,
      });
    });
  });

  describe('addItem', () => {
    const add = (quantity = 2) =>
      service.addItem(USER_ID, { productId: 'p1', quantity });

    it.each([
      ['missing', null],
      ['a draft', product({ status: ProductStatus.Draft })],
    ])('answers 404 for a product that is %s', async (_case, found) => {
      findProduct(found);

      await expect(add()).rejects.toThrow(
        new NotFoundException('products.NOT_FOUND'),
      );
      expect(managerMock.upsert).not.toHaveBeenCalled();
    });

    it('answers 409 with no stock left for a product out of stock', async () => {
      findProduct(product({ stock: 0 }));

      const error = await caught(add());

      expect(error).toBeInstanceOf(ConflictException);
      expect(error.getResponse()).toEqual({
        message: 'cart.OUT_OF_STOCK',
        details: { availableStock: 0 },
      });
      expect(managerMock.upsert).not.toHaveBeenCalled();
    });

    it('answers 422 once the cart would hold more than the per-product limit', async () => {
      findProduct(product({ stock: 500 }));
      managerMock.findOneBy.mockImplementation((entity: unknown) =>
        Promise.resolve(
          entity === Product
            ? product({ stock: 500 })
            : item({ quantity: CART_ITEM_MAX_QUANTITY }),
        ),
      );

      await expect(add(1)).rejects.toThrow(
        new UnprocessableEntityException(
          `cart.QUANTITY_LIMIT{"limit":${CART_ITEM_MAX_QUANTITY}}`,
        ),
      );
      expect(managerMock.upsert).not.toHaveBeenCalled();
    });

    it('creates the cart if missing and locks it before reading the item', async () => {
      await add();

      expect(insertBuilder.into).toHaveBeenCalledWith(Cart);
      expect(insertBuilder.values).toHaveBeenCalledWith({ userId: USER_ID });
      expect(insertBuilder.orIgnore).toHaveBeenCalled();
      expect(managerMock.findOneOrFail).toHaveBeenCalledWith(Cart, {
        where: { userId: USER_ID },
        lock: { mode: 'pessimistic_write' },
      });
    });

    it('stores a new product with the requested quantity', async () => {
      await add(3);

      expect(managerMock.upsert).toHaveBeenCalledWith(
        CartItem,
        { cartId: CART.id, productId: 'p1', quantity: 3 },
        ['cartId', 'productId'],
      );
    });

    it('adds to the quantity of a product already in the cart', async () => {
      managerMock.findOneBy.mockImplementation((entity: unknown) =>
        Promise.resolve(entity === Product ? product() : item()),
      );

      await add(3);

      expect(managerMock.upsert).toHaveBeenCalledWith(
        CartItem,
        expect.objectContaining({ quantity: 5 }),
        ['cartId', 'productId'],
      );
    });

    it('answers 409 with the stock left when the total would exceed it', async () => {
      managerMock.findOneBy.mockImplementation((entity: unknown) =>
        Promise.resolve(
          entity === Product ? product({ stock: 4 }) : item({ quantity: 3 }),
        ),
      );

      const error = await caught(add(2));

      expect(error).toBeInstanceOf(ConflictException);
      expect(error.getResponse()).toEqual({
        message: 'cart.INSUFFICIENT_STOCK{"available":4}',
        details: { availableStock: 4 },
      });
      expect(managerMock.upsert).not.toHaveBeenCalled();
    });

    it('returns the cart after the change', async () => {
      viewBuilder.getMany.mockResolvedValue([item()]);

      const view = await add();

      expect(view.lines).toHaveLength(1);
    });
  });

  describe('updateItem', () => {
    const update = (quantity = 4) =>
      service.updateItem(USER_ID, 'i1', { quantity });

    beforeEach(() => {
      managerMock.findOneBy.mockImplementation((entity: unknown) =>
        Promise.resolve(entity === Product ? product({ stock: 5 }) : item()),
      );
    });

    it('sets the quantity of an item in my cart', async () => {
      await update(4);

      expect(managerMock.findOneBy).toHaveBeenCalledWith(CartItem, {
        id: 'i1',
        cartId: CART.id,
      });
      expect(managerMock.update).toHaveBeenCalledWith(
        CartItem,
        { id: 'i1' },
        { quantity: 4 },
      );
    });

    it("answers 404 for an item of someone else's cart", async () => {
      managerMock.findOneBy.mockResolvedValue(null);

      await expect(update()).rejects.toThrow(
        new NotFoundException('cart.ITEM_NOT_FOUND'),
      );
      expect(managerMock.update).not.toHaveBeenCalled();
    });

    it('answers 404 when I have no cart at all', async () => {
      managerMock.findOne.mockResolvedValue(null);

      await expect(update()).rejects.toThrow(
        new NotFoundException('cart.ITEM_NOT_FOUND'),
      );
    });

    it('answers 409 for a quantity above the stock', async () => {
      await expect(update(6)).rejects.toThrow(ConflictException);
      expect(managerMock.update).not.toHaveBeenCalled();
    });

    it('answers 404 once the product is no longer on sale', async () => {
      managerMock.findOneBy.mockImplementation((entity: unknown) =>
        Promise.resolve(
          entity === Product
            ? product({ status: ProductStatus.Archived })
            : item(),
        ),
      );

      await expect(update()).rejects.toThrow(
        new NotFoundException('products.NOT_FOUND'),
      );
    });
  });

  describe('removeItem', () => {
    it('locks my cart, then deletes the item only from it', async () => {
      managerMock.delete.mockResolvedValue({ affected: 1 });

      await service.removeItem(USER_ID, 'i1');

      expect(managerMock.findOne).toHaveBeenCalledWith(Cart, {
        where: { userId: USER_ID },
        lock: { mode: 'pessimistic_write' },
      });
      expect(managerMock.delete).toHaveBeenCalledWith(CartItem, {
        id: 'i1',
        cartId: CART.id,
      });
    });

    it("answers 404 for an item of someone else's cart", async () => {
      managerMock.delete.mockResolvedValue({ affected: 0 });

      await expect(service.removeItem(USER_ID, 'i1')).rejects.toThrow(
        new NotFoundException('cart.ITEM_NOT_FOUND'),
      );
    });

    it('answers 404 when I have no cart at all', async () => {
      managerMock.findOne.mockResolvedValue(null);

      await expect(service.removeItem(USER_ID, 'i1')).rejects.toThrow(
        NotFoundException,
      );
      expect(managerMock.delete).not.toHaveBeenCalled();
    });
  });

  describe('clear', () => {
    it('locks my cart, deletes every item and keeps the cart', async () => {
      await service.clear(USER_ID);

      expect(managerMock.findOne).toHaveBeenCalledWith(Cart, {
        where: { userId: USER_ID },
        lock: { mode: 'pessimistic_write' },
      });
      expect(managerMock.delete).toHaveBeenCalledWith(CartItem, {
        cartId: CART.id,
      });
    });

    it('does nothing without a cart', async () => {
      managerMock.findOne.mockResolvedValue(null);

      await service.clear(USER_ID);

      expect(managerMock.delete).not.toHaveBeenCalled();
    });
  });

  describe('removeItems', () => {
    it('deletes exactly the given items', async () => {
      await service.removeItems(manager, [item(), item({ id: 'i2' })]);

      expect(managerMock.delete).toHaveBeenCalledWith(CartItem, {
        id: In(['i1', 'i2']),
      });
    });
  });

  describe('lockItems', () => {
    it('locks my cart and returns its items, oldest first', async () => {
      managerMock.find.mockResolvedValue([item()]);

      await expect(service.lockItems(manager, USER_ID)).resolves.toEqual([
        item(),
      ]);
      expect(managerMock.findOne).toHaveBeenCalledWith(Cart, {
        where: { userId: USER_ID },
        lock: { mode: 'pessimistic_write' },
      });
      expect(managerMock.find).toHaveBeenCalledWith(CartItem, {
        where: { cartId: CART.id },
        order: { createdAt: 'ASC', id: 'ASC' },
      });
    });

    it('returns nothing without a cart', async () => {
      managerMock.findOne.mockResolvedValue(null);

      await expect(service.lockItems(manager, USER_ID)).resolves.toEqual([]);
      expect(managerMock.find).not.toHaveBeenCalled();
    });
  });
});
