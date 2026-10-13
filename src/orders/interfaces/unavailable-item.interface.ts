import { UnavailableItemReason } from '../orders.constants';

export interface UnavailableItem {
  productId: string;
  name: string;
  reason: UnavailableItemReason;
  availableStock: number;
}
