import { registerAs } from '@nestjs/config';

import {
  DEFAULT_ORDER_AUTO_CANCEL_DAYS,
  DEFAULT_SHIPPING_FEE,
} from './config.constants';

export interface OrdersConfig {
  shippingFee: number;
  autoCancelDays: number;
}

export const ORDERS_CONFIG_KEY = 'orders';

export default registerAs(ORDERS_CONFIG_KEY, (): OrdersConfig => ({
  shippingFee: parseInt(
    process.env.SHIPPING_FEE ?? String(DEFAULT_SHIPPING_FEE),
    10,
  ),
  autoCancelDays: parseInt(
    process.env.ORDER_AUTO_CANCEL_DAYS ??
      String(DEFAULT_ORDER_AUTO_CANCEL_DAYS),
    10,
  ),
}));
