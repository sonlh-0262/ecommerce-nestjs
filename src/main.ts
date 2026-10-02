import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { configureApp } from './config/app-setup';
import { APP_CONFIG_KEY, AppConfig } from './config/configuration';
import { setupSwagger } from './config/swagger';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    logger:
      process.env.NODE_ENV === 'production'
        ? ['log', 'error', 'warn']
        : ['log', 'error', 'warn', 'debug', 'verbose'],
  });

  const configService = app.get(ConfigService);
  const appConfig = configService.getOrThrow<AppConfig>(APP_CONFIG_KEY);

  configureApp(app, appConfig);
  setupSwagger(app, appConfig);

  app.enableShutdownHooks();

  await app.listen(appConfig.port, '0.0.0.0');

  const logger = new Logger('Bootstrap');
  logger.log(`${appConfig.name} is running on port ${appConfig.port}`);
  if (appConfig.swagger.enabled) {
    logger.log(
      `Swagger UI: /${appConfig.swagger.path} (JSON: /${appConfig.swagger.path}-json)`,
    );
  }
}

void bootstrap();
