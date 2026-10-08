import { INestApplication, RequestMethod } from '@nestjs/common';
import {
  I18nService,
  I18nValidationExceptionFilter,
  I18nValidationPipe,
} from 'nestjs-i18n';

import { HEALTH_ROUTE } from '../common/constants/routes';
import { toErrorResponse } from '../common/dto/error-response.dto';
import { AllExceptionsFilter } from '../common/filters/all-exceptions.filter';
import { AppConfig } from './configuration';

/**
 * Applies every cross-cutting concern (prefix, CORS, validation, i18n error
 * rendering) to a Nest application instance.
 *
 * Shared by `main.ts` and the e2e tests so both run against an identically
 * configured app.
 */
export function configureApp(
  app: INestApplication,
  appConfig: AppConfig,
): INestApplication {
  if (appConfig.apiPrefix) {
    // Health is excluded: it is a probe, not part of the API contract, and it
    // must not move when the version in the prefix changes.
    app.setGlobalPrefix(appConfig.apiPrefix, {
      exclude: [{ path: HEALTH_ROUTE, method: RequestMethod.GET }],
    });
  }

  app.enableCors();

  // `I18nValidationPipe` is a `ValidationPipe` whose errors carry translation
  // keys, which the filter below renders in the request language.
  app.useGlobalPipes(
    new I18nValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(
    new AllExceptionsFilter(app.get(I18nService)),
    new I18nValidationExceptionFilter({
      detailedErrors: false,
      responseBodyFormatter: (_host, _exception, formattedErrors) => ({
        ...toErrorResponse(formattedErrors as string[]),
      }),
    }),
  );

  return app;
}
