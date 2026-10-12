import { LogLevel } from '@nestjs/common';

export const CONSOLE_LOGGER_CONTEXT = 'Console';

export const CONSOLE_LOG_LEVELS: LogLevel[] = ['log', 'warn', 'error'];

export const SEED_COMMANDS = {
  admin: 'seed:admin',
  categories: 'seed:categories',
  products: 'seed:products',
} as const;
