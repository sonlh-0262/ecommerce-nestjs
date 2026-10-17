import * as path from 'path';

import { SeedAdminAccount } from './interfaces/seed-admin-account.interface';

export const SEED_PASSWORD = 'Password@123';

export const DEFAULT_SEED_ADMIN: SeedAdminAccount = {
  email: 'admin@example.com',
  username: 'admin',
  fullName: 'Seed Admin',
  password: SEED_PASSWORD,
};

export const SEED_IMAGES_DIRECTORY = path.join(__dirname, 'images');

export const SEED_IMAGE_FILES = [
  'placeholder-1.png',
  'placeholder-2.png',
  'placeholder-3.png',
] as const;

export const SEED_SCRAMBLE = 7919;

export const SEED_PRICE_MIN = 50_000;
export const SEED_PRICE_STEP = 10_000;
export const SEED_PRICE_STEPS = 496;
export const SEED_PRICE_ROUNDING = 1_000;
export const SEED_SALE_RATIO = 0.9;
export const SEED_SALE_EVERY = 4;

export const SEED_STOCK_MIN = 5;
export const SEED_STOCK_SPREAD = 95;
export const SEED_SOLD_OUT_EVERY = 7;

export const SEED_PUBLISH_CYCLE = 5;
export const SEED_FEATURED_SLOT = 1;

export const DEMO_RANDOM_SEED = 20261017;

export const DEMO_ARCHIVED_EVERY = 2;

export const DEMO_MAX_QUANTITY = 2;

export const DEMO_DELIVERY_SPREAD_MONTHS = 12;
export const DEMO_DELIVERY_MAX_DAY_OFFSET = 20;

export const DEMO_REJECT_REASON = 'Hết hàng tại kho giao, không thể xử lý đơn';
export const DEMO_CANCEL_REASON = 'Đặt nhầm sản phẩm';
export const DEMO_TRANSACTION_REF_PREFIX = 'DEMO-TXN-';
export const DEMO_RECEIVER_PHONE = '0901234567';
export const DEMO_SHIPPING_ADDRESS = '1 Nguyễn Trãi, Thanh Xuân, Hà Nội';
