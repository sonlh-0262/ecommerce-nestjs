import { registerAs } from '@nestjs/config';

export interface SeedConfig {
  adminEmail?: string;
  adminPassword?: string;
}

export const SEED_CONFIG_KEY = 'seed';

export default registerAs(SEED_CONFIG_KEY, (): SeedConfig => ({
  adminEmail: process.env.SEED_ADMIN_EMAIL || undefined,
  adminPassword: process.env.SEED_ADMIN_PASSWORD || undefined,
}));
