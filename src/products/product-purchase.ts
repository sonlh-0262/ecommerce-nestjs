import { Product } from './entities/product.entity';
import { ProductStatus } from './enums/product-status.enum';

export interface LinePrice {
  unitPrice: number;
  lineTotal: number;
}

export function isPurchasable(
  product: Pick<Product, 'status' | 'deletedAt'>,
): boolean {
  return product.status === ProductStatus.Published && !product.deletedAt;
}

export function canFulfil(
  product: Pick<Product, 'status' | 'deletedAt' | 'stock'>,
  quantity: number,
): boolean {
  return isPurchasable(product) && product.stock >= quantity;
}

export function priceLine(
  product: Pick<Product, 'price' | 'salePrice'>,
  quantity: number,
): LinePrice {
  const unitPrice = product.salePrice ?? product.price;

  return { unitPrice, lineTotal: unitPrice * quantity };
}

export function subtotalOf(lines: Pick<LinePrice, 'lineTotal'>[]): number {
  return lines.reduce((sum, { lineTotal }) => sum + lineTotal, 0);
}
