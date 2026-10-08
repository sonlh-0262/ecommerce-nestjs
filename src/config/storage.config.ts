import { registerAs } from '@nestjs/config';

import { DEFAULT_STORAGE_ROOT } from './config.constants';

export interface StorageConfig {
  root: string;
}

export const STORAGE_CONFIG_KEY = 'storage';

export default registerAs(STORAGE_CONFIG_KEY, (): StorageConfig => ({
  root: process.env.STORAGE_ROOT ?? DEFAULT_STORAGE_ROOT,
}));
