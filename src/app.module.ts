import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import Redis from 'ioredis';
import {
  AcceptLanguageResolver,
  HeaderResolver,
  I18nModule,
  I18nService,
  QueryResolver,
} from 'nestjs-i18n';
import * as path from 'path';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import {
  LANGUAGE_FALLBACKS,
  LANGUAGE_HEADER,
  LANGUAGE_QUERY_PARAMS,
} from './common/constants/languages';
import { AcceptLanguageAliasResolver } from './common/resolvers/accept-language-alias.resolver';
import authConfig from './config/auth.config';
import { buildBullOptions } from './config/bull-options';
import configuration, {
  APP_CONFIG_KEY,
  AppConfig,
} from './config/configuration';
import databaseConfig from './config/database.config';
import { envFilePaths } from './config/env-files';
import { envValidationSchema } from './config/env.validation';
import mailConfig from './config/mail.config';
import redisConfig, {
  REDIS_CONFIG_KEY,
  RedisConfig,
} from './config/redis.config';
import throttleConfig, {
  THROTTLE_CONFIG_KEY,
  ThrottleConfig,
} from './config/throttle.config';
import { buildThrottlerOptions } from './config/throttler-options';
import { DatabaseModule } from './database/database.module';
import { MailModule } from './mail/mail.module';
import { REDIS_CLIENT } from './redis/redis.constants';
import { RedisModule } from './redis/redis.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [
        configuration,
        databaseConfig,
        redisConfig,
        authConfig,
        throttleConfig,
        mailConfig,
      ],
      validationSchema: envValidationSchema,
      validationOptions: { abortEarly: false },
      envFilePath: envFilePaths(),
    }),
    I18nModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const config = configService.getOrThrow<AppConfig>(APP_CONFIG_KEY);

        return {
          fallbackLanguage: config.fallbackLanguage,
          fallbacks: LANGUAGE_FALLBACKS,
          loaderOptions: {
            path: path.join(__dirname, '/i18n/'),
            watch: config.nodeEnv !== 'production',
          },
        };
      },
      resolvers: [
        { use: QueryResolver, options: LANGUAGE_QUERY_PARAMS },
        new HeaderResolver([LANGUAGE_HEADER]),
        // Must come before the bundled resolver: it maps regional tags such as
        // `vi-VN` onto the `vi` catalogue, which the bundled one cannot do.
        AcceptLanguageAliasResolver,
        AcceptLanguageResolver,
      ],
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService, REDIS_CLIENT, I18nService],
      useFactory: (
        configService: ConfigService,
        redis: Redis,
        i18n: I18nService,
      ) =>
        buildThrottlerOptions(
          configService.getOrThrow<ThrottleConfig>(THROTTLE_CONFIG_KEY),
          redis,
          i18n,
        ),
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        buildBullOptions(
          configService.getOrThrow<RedisConfig>(REDIS_CONFIG_KEY),
        ),
    }),
    DatabaseModule,
    RedisModule,
    MailModule,
    UsersModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
