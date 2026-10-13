import { Product } from '../products/entities/product.entity';
import { priceOrder } from './order-pricing';

describe('priceOrder', () => {
  const SHIPPING_FEE = 30000;

  const product = (price: number, salePrice: number | null = null) =>
    ({ id: `p${price}`, price, salePrice }) as Product;

  it('prices each line as unit price times quantity', () => {
    const { lines } = priceOrder(
      [{ product: product(150000), quantity: 2 }],
      SHIPPING_FEE,
    );

    expect(lines[0]).toMatchObject({
      unitPrice: 150000,
      quantity: 2,
      lineTotal: 300000,
    });
  });

  it('charges the sale price when the product has one', () => {
    const { lines } = priceOrder(
      [{ product: product(150000, 120000), quantity: 3 }],
      SHIPPING_FEE,
    );

    expect(lines[0]).toMatchObject({ unitPrice: 120000, lineTotal: 360000 });
  });

  it('adds the lines into the subtotal and the shipping fee into the total', () => {
    expect(
      priceOrder(
        [
          { product: product(150000), quantity: 2 },
          { product: product(49900, 45000), quantity: 1 },
        ],
        SHIPPING_FEE,
      ),
    ).toMatchObject({ subtotal: 345000, shippingFee: 30000, total: 375000 });
  });

  it('stays in whole VND without rounding drift', () => {
    const { lines, subtotal, total } = priceOrder(
      [
        { product: product(33333), quantity: 3 },
        { product: product(10001, 9999), quantity: 7 },
      ],
      SHIPPING_FEE,
    );

    expect(lines.map(({ lineTotal }) => lineTotal)).toEqual([99999, 69993]);
    expect(subtotal).toBe(169992);
    expect(total).toBe(199992);
    expect([subtotal, total].every(Number.isInteger)).toBe(true);
  });

  it('totals the subtotal alone when shipping is free', () => {
    expect(
      priceOrder([{ product: product(100000), quantity: 1 }], 0),
    ).toMatchObject({ subtotal: 100000, shippingFee: 0, total: 100000 });
  });
});
