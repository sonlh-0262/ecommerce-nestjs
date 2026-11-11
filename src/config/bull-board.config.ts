import { registerAs } from '@nestjs/config';

export interface BullBoardConfig {
  username: string;
  password: string;
}

export const BULL_BOARD_CONFIG_KEY = 'bullBoard';

export default registerAs(BULL_BOARD_CONFIG_KEY, (): BullBoardConfig => ({
  username: process.env.BULL_BOARD_USERNAME ?? '',
  password: process.env.BULL_BOARD_PASSWORD ?? '',
}));
