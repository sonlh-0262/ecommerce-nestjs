import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  AcceptLanguageResolver,
  HeaderResolver,
  I18nModule,
  QueryResolver,
} from 'nestjs-i18n';
import * as path from 'path';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import {
  LANGUAGE_FALLBACKS,
  LANGUAGE_HEADER,
  LANGUAGE_QUERY_PARAMS,
} from './common/constants/languages';
import { AcceptLanguageAliasResolver } from './common/resolvers/accept-language-alias.resolver';
import authConfig from './config/auth.config';
import configuration, {
  APP_CONFIG_KEY,
  AppConfig,
} from './config/configuration';
import databaseConfig from './config/database.config';
import { envFilePaths } from './config/env-files';
import { envValidationSchema } from './config/env.validation';
import redisConfig from './config/redis.config';
import { DatabaseModule } from './database/database.module';
import { RedisModule } from './redis/redis.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [configuration, databaseConfig, redisConfig, authConfig],
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
    DatabaseModule,
    RedisModule,
    UsersModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
