import * as path from 'path';

import { SeedAdminAccount } from './interfaces/seed-admin-account.interface';

const SEED_PASSWORD = 'Password@123';

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
