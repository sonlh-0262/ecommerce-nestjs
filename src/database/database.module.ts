import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DatabaseConfig, DATABASE_CONFIG_KEY } from '../config/database.config';
import { buildDataSourceOptions } from './data-source-options';

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
})
export class DatabaseModule {}
