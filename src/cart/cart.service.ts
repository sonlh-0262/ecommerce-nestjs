import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { I18nService } from 'nestjs-i18n';
import {
  DataSource,
  EntityManager,
  FindOneOptions,
  In,
  Repository,
} from 'typeorm';

import { withDetails } from '../common/dto/error-response.dto';
import { Product } from '../products/entities/product.entity';
import { ProductThumbnailsService } from '../products/product-thumbnails.service';
import {
  canFulfil,
  isPurchasable,
  priceLine,
  subtotalOf,
} from '../products/product-purchase';
import { CART_ITEM_MAX_QUANTITY } from './cart.constants';
import { AddCartItemBodyDto } from './dto/add-cart-item.dto';
import { UpdateCartItemBodyDto } from './dto/update-cart-item.dto';
import { CartItem } from './entities/cart-item.entity';
import { Cart } from './entities/cart.entity';
import { CartView } from './interfaces/cart-view.interface';

const lockedCartOf = (userId: string): FindOneOptions<Cart> => ({
  where: { userId },
  lock: { mode: 'pessimistic_write' },
});

@Injectable()
export class CartService {
  constructor(
    @InjectRepository(CartItem)
    private readonly itemsRepository: Repository<CartItem>,
    private readonly dataSource: DataSource,
    private readonly thumbnails: ProductThumbnailsService,
    private readonly i18n: I18nService,
  ) {}

  async view(userId: string): Promise<CartView> {
    const items = await this.itemsRepository
      .createQueryBuilder('item')
      .innerJoin('item.cart', 'cart')
      .innerJoinAndSelect('item.product', 'product')
      .withDeleted()
      .where('cart.userId = :userId', { userId })
      .orderBy('item.createdAt', 'ASC')
      .addOrderBy('item.id', 'ASC')
      .getMany();
    const thumbnailUrls = await this.thumbnails.urlsOf(
      items.map(({ productId }) => productId),
    );

    const lines = items.map((item) => ({
      ...priceLine(item.product, item.quantity),
      item,
      thumbnailUrl: thumbnailUrls.get(item.productId) ?? null,
      available: canFulfil(item.product, item.quantity),
    }));

    return {
      lines,
      subtotal: subtotalOf(lines.filter(({ available }) => available)),
    };
  }

  async addItem(
    userId: string,
    { productId, quantity }: AddCartItemBodyDto,
  ): Promise<CartView> {
    await this.dataSource.transaction(async (manager) => {
      const product = await this.findPurchasable(manager, productId);
      const cart = await this.lockOrCreateCart(manager, userId);
      const existing = await manager.findOneBy(CartItem, {
        cartId: cart.id,
        productId,
      });
      const total = (existing?.quantity ?? 0) + quantity;

      this.assertStock(product, total);

      await manager.upsert(
        CartItem,
        { cartId: cart.id, productId, quantity: total },
        ['cartId', 'productId'],
      );
    });

    return this.view(userId);
  }

  async updateItem(
    userId: string,
    itemId: string,
    { quantity }: UpdateCartItemBodyDto,
  ): Promise<CartView> {
    await this.dataSource.transaction(async (manager) => {
      const cart = await manager.findOne(Cart, lockedCartOf(userId));
      const item = cart
        ? await manager.findOneBy(CartItem, { id: itemId, cartId: cart.id })
        : null;

      if (!item) {
        throw this.itemNotFound();
      }

      this.assertStock(
        await this.findPurchasable(manager, item.productId),
        quantity,
      );

      await manager.update(CartItem, { id: item.id }, { quantity });
    });

    return this.view(userId);
  }

  async removeItem(userId: string, itemId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const cart = await manager.findOne(Cart, lockedCartOf(userId));
      const removed = cart
        ? await manager.delete(CartItem, { id: itemId, cartId: cart.id })
        : null;

      if (!removed?.affected) {
        throw this.itemNotFound();
      }
    });
  }

  async clear(userId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const cart = await manager.findOne(Cart, lockedCartOf(userId));

      if (cart) {
        await manager.delete(CartItem, { cartId: cart.id });
      }
    });
  }

  async lockItems(manager: EntityManager, userId: string): Promise<CartItem[]> {
    const cart = await manager.findOne(Cart, lockedCartOf(userId));

    return cart
      ? manager.find(CartItem, {
          where: { cartId: cart.id },
          order: { createdAt: 'ASC', id: 'ASC' },
        })
      : [];
  }

  async removeItems(manager: EntityManager, items: CartItem[]): Promise<void> {
    await manager.delete(CartItem, { id: In(items.map(({ id }) => id)) });
  }

  private async lockOrCreateCart(
    manager: EntityManager,
    userId: string,
  ): Promise<Cart> {
    await manager
      .createQueryBuilder()
      .insert()
      .into(Cart)
      .values({ userId })
      .orIgnore()
      .execute();

    return manager.findOneOrFail(Cart, lockedCartOf(userId));
  }

  private async findPurchasable(
    manager: EntityManager,
    productId: string,
  ): Promise<Product> {
    const product = await manager.findOneBy(Product, { id: productId });

    if (!product || !isPurchasable(product)) {
      throw new NotFoundException(this.i18n.t('products.NOT_FOUND'));
    }

    return product;
  }

  private assertStock(product: Product, quantity: number): void {
    if (quantity > CART_ITEM_MAX_QUANTITY) {
      throw new UnprocessableEntityException(
        this.i18n.t('cart.QUANTITY_LIMIT', {
          args: { limit: CART_ITEM_MAX_QUANTITY },
        }),
      );
    }

    if (product.stock === 0) {
      throw new ConflictException(
        withDetails(this.i18n.t('cart.OUT_OF_STOCK'), { availableStock: 0 }),
      );
    }

    if (quantity > product.stock) {
      throw new ConflictException(
        withDetails(
          this.i18n.t('cart.INSUFFICIENT_STOCK', {
            args: { available: product.stock },
          }),
          { availableStock: product.stock },
        ),
      );
    }
  }

  private itemNotFound(): NotFoundException {
    return new NotFoundException(this.i18n.t('cart.ITEM_NOT_FOUND'));
  }
}
