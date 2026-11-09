import { Product } from '../products/entities/product.entity';
import { LinePrice, priceLine, subtotalOf } from '../products/product-purchase';

export interface OrderLine {
  product: Product;
  quantity: number;
}

export interface PricedOrderLine extends OrderLine, LinePrice {}

export interface ShopLines {
  shopId: string | null;
  lines: OrderLine[];
}

export interface PricedOrder {
  lines: PricedOrderLine[];
  subtotal: number;
  shippingFee: number;
  total: number;
}

export function splitByShop(lines: OrderLine[]): ShopLines[] {
  const groups = new Map<string | null, OrderLine[]>();

  for (const line of lines) {
    const group = groups.get(line.product.shopId);

    if (group) {
      group.push(line);
    } else {
      groups.set(line.product.shopId, [line]);
    }
  }

  return [...groups].map(([shopId, grouped]) => ({ shopId, lines: grouped }));
}

export function priceOrder(
  lines: OrderLine[],
  shippingFee: number,
): PricedOrder {
  const priced = lines.map((line) => ({
    ...line,
    ...priceLine(line.product, line.quantity),
  }));
  const subtotal = subtotalOf(priced);

  return {
    lines: priced,
    subtotal,
    shippingFee,
    total: subtotal + shippingFee,
  };
}
