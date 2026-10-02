import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import {
  LANGUAGE_QUERY_PARAM,
  SUPPORTED_LANGUAGES,
  SUPPORTED_LANGUAGES_LABEL,
} from '../common/constants/languages';
import { SWAGGER_BEARER_AUTH_NAME } from '../common/constants/swagger';
import { AppConfig } from './configuration';

/**
 * Mounts the OpenAPI document at `SWAGGER_PATH` (`/docs` by default); the raw
 * JSON document is served from the same path with `-json` appended.
 *
 * Outside the versioned API prefix, so the docs do not move with the version.
 */
export function setupSwagger(
  app: INestApplication,
  appConfig: AppConfig,
): void {
  if (!appConfig.swagger.enabled) {
    return;
  }

  const config = new DocumentBuilder()
    .setTitle(appConfig.name)
    .setDescription(
      [
        'E-commerce API.',
        '',
        `Responses are localised (${SUPPORTED_LANGUAGES_LABEL}). Choose a language with the`,
        '`?lang=vi` query parameter, the `x-lang` header, or a standard',
        '`Accept-Language` header.',
      ].join('\n'),
    )
    .setVersion('0.1.0')
    .addGlobalParameters({
      name: LANGUAGE_QUERY_PARAM,
      in: 'query',
      required: false,
      description: `Response language (${SUPPORTED_LANGUAGES_LABEL}).`,
      schema: { type: 'string', enum: [...SUPPORTED_LANGUAGES] },
    })
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description:
          'Access token returned by the login endpoint. Paste the raw JWT - ' +
          'Swagger UI sends it as `Authorization: Bearer <token>`.',
      },
      SWAGGER_BEARER_AUTH_NAME,
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup(appConfig.swagger.path, app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
  });
}
