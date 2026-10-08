import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DatabaseConfig, DATABASE_CONFIG_KEY } from '../config/database.config';
import { buildDataSourceOptions } from './data-source-options';
import { TransactionHooks } from './transaction-hooks.service';

@Global()
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        buildDataSourceOptions(
          configService.getOrThrow<DatabaseConfig>(DATABASE_CONFIG_KEY),
        ),
    }),
  ],
  providers: [TransactionHooks],
  exports: [TransactionHooks],
})
export class DatabaseModule {}
