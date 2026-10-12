import { ProductStatus } from './enums/product-status.enum';
import {
  canFulfil,
  isPurchasable,
  priceLine,
  subtotalOf,
} from './product-purchase';

describe('product purchase rules', () => {
  describe('isPurchasable', () => {
    it('accepts a published product', () => {
      expect(
        isPurchasable({ status: ProductStatus.Published, deletedAt: null }),
      ).toBe(true);
    });

    it.each([ProductStatus.Draft, ProductStatus.Archived])(
      'refuses a %s product',
      (status) => {
        expect(isPurchasable({ status, deletedAt: null })).toBe(false);
      },
    );

    it('refuses a deleted product whatever its status', () => {
      expect(
        isPurchasable({
          status: ProductStatus.Published,
          deletedAt: new Date(),
        }),
      ).toBe(false);
    });
  });

  describe('canFulfil', () => {
    const onSale = { status: ProductStatus.Published, deletedAt: null };

    it('accepts a quantity up to the stock', () => {
      expect(canFulfil({ ...onSale, stock: 3 }, 3)).toBe(true);
    });

    it('refuses a quantity above the stock', () => {
      expect(canFulfil({ ...onSale, stock: 3 }, 4)).toBe(false);
    });

    it('refuses a product that is not on sale, whatever the stock', () => {
      expect(
        canFulfil({ ...onSale, status: ProductStatus.Draft, stock: 10 }, 1),
      ).toBe(false);
    });
  });

  describe('priceLine', () => {
    it('charges the regular price without a sale', () => {
      expect(priceLine({ price: 150000, salePrice: null }, 2)).toEqual({
        unitPrice: 150000,
        lineTotal: 300000,
      });
    });

    it('charges the sale price when there is one', () => {
      expect(priceLine({ price: 150000, salePrice: 99000 }, 3)).toEqual({
        unitPrice: 99000,
        lineTotal: 297000,
      });
    });
  });

  describe('subtotalOf', () => {
    it('adds up the line totals', () => {
      expect(subtotalOf([{ lineTotal: 300000 }, { lineTotal: 45000 }])).toBe(
        345000,
      );
    });

    it('is zero without lines', () => {
      expect(subtotalOf([])).toBe(0);
    });
  });
});
