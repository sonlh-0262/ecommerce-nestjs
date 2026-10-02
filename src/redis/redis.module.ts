import {
  Global,
  Inject,
  Logger,
  Module,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

import { RedisConfig, REDIS_CONFIG_KEY } from '../config/redis.config';
import { REDIS_CLIENT } from './redis.constants';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService): Redis => {
        const config = configService.getOrThrow<RedisConfig>(REDIS_CONFIG_KEY);
        const logger = new Logger('RedisModule');

        const client = new Redis({
          host: config.host,
          port: config.port,
          password: config.password,
          db: config.db,
          keyPrefix: config.keyPrefix,
          maxRetriesPerRequest: 3,
          enableReadyCheck: true,
        });

        client.on('error', (error: Error) => {
          logger.error(`Redis connection error: ${error.message}`);
        });
        client.on('ready', () => {
          logger.log(`Connected to Redis at ${config.host}:${config.port}`);
        });

        return client;
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule implements OnApplicationShutdown {
  constructor(@Inject(REDIS_CLIENT) private readonly client: Redis) {}

  async onApplicationShutdown(): Promise<void> {
    try {
      await this.client.quit();
    } catch {
      this.client.disconnect();
    }
  }
}
