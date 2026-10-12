import { CartItem } from '../entities/cart-item.entity';
import { toCartResponse } from './cart.dto';

describe('toCartResponse', () => {
  it('maps each line with its product and counts the distinct items', () => {
    const item = {
      id: 'i1',
      productId: 'p1',
      quantity: 2,
      product: { name: 'Áo thun', slug: 'ao-thun', stock: 10 },
    } as CartItem;

    expect(
      toCartResponse({
        lines: [
          {
            item,
            unitPrice: 150000,
            lineTotal: 300000,
            thumbnailUrl: '/thumb',
            available: true,
          },
        ],
        subtotal: 300000,
      }),
    ).toEqual({
      cart: {
        items: [
          {
            id: 'i1',
            productId: 'p1',
            name: 'Áo thun',
            slug: 'ao-thun',
            thumbnailUrl: '/thumb',
            unitPrice: 150000,
            quantity: 2,
            lineTotal: 300000,
            stock: 10,
            available: true,
          },
        ],
        itemsCount: 1,
        subtotal: 300000,
      },
    });
  });
});
