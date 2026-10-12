import { LinePrice } from '../../products/product-purchase';
import { CartItem } from '../entities/cart-item.entity';

export interface CartLine extends LinePrice {
  item: CartItem;
  thumbnailUrl: string | null;
  available: boolean;
}

export interface CartView {
  lines: CartLine[];
  subtotal: number;
}
