import { I18nValidationPipe } from 'nestjs-i18n';

export function createValidationPipe(): I18nValidationPipe {
  return new I18nValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  });
}
