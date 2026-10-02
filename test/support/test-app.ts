import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import Redis from 'ioredis';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';

import { AppModule } from '../../src/app.module';
import { AuthService } from '../../src/auth/auth.service';
import { configureApp } from '../../src/config/app-setup';
import { APP_CONFIG_KEY, AppConfig } from '../../src/config/configuration';
import {
  DATABASE_CONFIG_KEY,
  DatabaseConfig,
} from '../../src/config/database.config';
import { REDIS_CONFIG_KEY, RedisConfig } from '../../src/config/redis.config';
import { setupSwagger } from '../../src/config/swagger';
import { REDIS_CLIENT } from '../../src/redis/redis.constants';
import { User } from '../../src/users/entities/user.entity';
import { PasswordService } from '../../src/users/password.service';
import { UserFactory } from './factories/user.factory';
import { TestAppOptions } from './interfaces/test-app-options.interface';
import { TestContext } from './interfaces/test-context.interface';
import { assertTestDatabase, clearDatabase } from './test-database';
import { assertTestRedis, clearRedis } from './test-redis';

/**
 * Boots the application exactly as `main.ts` does - one shared bootstrap, so a
 * spec can never drive an app configured differently from the real one.
 *
 * One app per spec file, not per case: booting costs seconds and a connection
 * pool, while `reset()` costs a couple of round trips.
 */
export async function createTestApp(
  options: TestAppOptions = {},
): Promise<TestContext> {
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication<INestApplication<App>>();
  const config = app.get(ConfigService);

  const redisConfig = config.getOrThrow<RedisConfig>(REDIS_CONFIG_KEY);

  // Before `init()`: one rail per store `reset()` wipes.
  assertTestDatabase(config.getOrThrow<DatabaseConfig>(DATABASE_CONFIG_KEY));
  assertTestRedis(redisConfig);

  const appConfig = config.getOrThrow<AppConfig>(APP_CONFIG_KEY);
  configureApp(app, appConfig);

  if (options.swagger) {
    setupSwagger(app, {
      ...appConfig,
      swagger: { ...appConfig.swagger, enabled: true },
    });
  }

  app.enableShutdownHooks();
  await app.init();

  const dataSource = app.get(DataSource);
  const redis = app.get<Redis>(REDIS_CLIENT);

  return {
    app,
    dataSource,
    users: new UserFactory(
      dataSource.getRepository(User),
      app.get(PasswordService),
      app.get(AuthService),
    ),
    server: () => app.getHttpServer(),
    reset: async () => {
      await clearDatabase(dataSource);
      await clearRedis(redis, redisConfig);
    },
    close: () => app.close(),
  };
}
