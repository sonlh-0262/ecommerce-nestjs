import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { I18nService } from 'nestjs-i18n';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppConfig } from './config/configuration';

describe('AppController', () => {
  let appController: AppController;

  const translations: Record<string, Record<string, string>> = {
    en: { 'common.health_ok': 'Service is healthy' },
    vi: { 'common.health_ok': 'Dịch vụ đang hoạt động bình thường' },
  };

  const i18nServiceMock = {
    t: jest.fn(
      (key: string, options: { lang: string }) =>
        translations[options.lang]?.[key] ?? key,
    ),
    resolveLanguage: jest.fn((lang: string) => lang.split('-')[0]),
    getSupportedLanguages: jest.fn(() => ['en', 'vi']),
  };

  const configServiceMock = {
    get: jest.fn((): Partial<AppConfig> => ({ fallbackLanguage: 'en' })),
  };

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        { provide: I18nService, useValue: i18nServiceMock },
        { provide: ConfigService, useValue: configServiceMock },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /health', () => {
    it('reports the service as healthy', () => {
      const result = appController.getHealth('en', {});

      expect(result.status).toBe('ok');
      expect(result.message).toBe('Service is healthy');
      expect(typeof result.uptime).toBe('number');
      expect(new Date(result.timestamp).toString()).not.toBe('Invalid Date');
    });

    it('localises the message', () => {
      expect(appController.getHealth('vi', {}).message).toBe(
        'Dịch vụ đang hoạt động bình thường',
      );
    });

    it('collapses a regional variant onto its base language', () => {
      expect(appController.getHealth('vi-VN', {}).message).toBe(
        'Dịch vụ đang hoạt động bình thường',
      );
    });

    it('falls back to the default language for an unsupported one', () => {
      expect(appController.getHealth('fr', {}).message).toBe(
        'Service is healthy',
      );
    });
  });
});
