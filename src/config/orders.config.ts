import { registerAs } from '@nestjs/config';

import { DEFAULT_SHIPPING_FEE } from './config.constants';

export interface OrdersConfig {
  shippingFee: number;
}

export const ORDERS_CONFIG_KEY = 'orders';

export default registerAs(ORDERS_CONFIG_KEY, (): OrdersConfig => ({
  shippingFee: parseInt(
    process.env.SHIPPING_FEE ?? String(DEFAULT_SHIPPING_FEE),
    10,
  ),
}));
