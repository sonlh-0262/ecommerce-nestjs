import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { BullBoardModule } from '@bull-board/nestjs';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import basicAuth from 'express-basic-auth';

import {
  BULL_BOARD_CONFIG_KEY,
  BullBoardConfig,
} from '../config/bull-board.config';
import { MAIL_QUEUE } from '../mail/mail.constants';
import { PAYMENTS_QUEUE } from '../payments/payments.constants';
import { QUEUE_BOARD_ROUTE } from './queue-board.constants';

@Module({
  imports: [
    BullBoardModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const config = configService.getOrThrow<BullBoardConfig>(
          BULL_BOARD_CONFIG_KEY,
        );

        return {
          route: QUEUE_BOARD_ROUTE,
          adapter: ExpressAdapter,
          middleware: basicAuth({
            users: { [config.username]: config.password },
            challenge: true,
          }),
        };
      },
    }),
    BullBoardModule.forFeature(
      { name: MAIL_QUEUE, adapter: BullMQAdapter },
      { name: PAYMENTS_QUEUE, adapter: BullMQAdapter },
    ),
  ],
})
export class QueueBoardModule {}
