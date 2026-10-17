import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  HealthCheckResult,
  HealthCheckService,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { I18nService } from 'nestjs-i18n';

import { AppConfig } from '../config/configuration';
import { HealthService } from './health.service';
import { HealthUnavailableException } from './health-unavailable.exception';
import { RedisHealthIndicator } from './redis.health';

describe('HealthService', () => {
  let service: HealthService;

  const translations: Record<string, Record<string, string>> = {
    en: {
      'common.health_ok': 'Service is healthy',
      'common.health_unavailable': 'One or more dependencies are unavailable',
    },
    vi: { 'common.health_ok': 'Dịch vụ đang hoạt động bình thường' },
  };

  const healthy: HealthCheckResult = {
    status: 'ok',
    info: { database: { status: 'up' }, redis: { status: 'up' } },
    error: {},
    details: { database: { status: 'up' }, redis: { status: 'up' } },
  };

  const redisDown: HealthCheckResult = {
    status: 'error',
    info: { database: { status: 'up' } },
    error: { redis: { status: 'down', message: 'connection refused' } },
    details: {
      database: { status: 'up' },
      redis: { status: 'down', message: 'connection refused' },
    },
  };

  const healthCheckMock = { check: jest.fn() };
  const databaseMock = { pingCheck: jest.fn() };
  const redisMock = { pingCheck: jest.fn() };
  const i18nMock = {
    t: jest.fn(
      (key: string, options: { lang: string }) =>
        translations[options.lang]?.[key] ?? key,
    ),
    resolveLanguage: jest.fn((lang: string) => lang.split('-')[0]),
    getSupportedLanguages: jest.fn(() => ['en', 'vi']),
  };
  const configMock = {
    get: jest.fn((): Partial<AppConfig> => ({ fallbackLanguage: 'en' })),
  };

  const failure = async (): Promise<HealthUnavailableException> => {
    const error: unknown = await service.check('en').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(HealthUnavailableException);

    return error as HealthUnavailableException;
  };

  beforeEach(() => {
    service = new HealthService(
      healthCheckMock as unknown as HealthCheckService,
      databaseMock as unknown as TypeOrmHealthIndicator,
      redisMock as unknown as RedisHealthIndicator,
      i18nMock as unknown as I18nService,
      configMock as unknown as ConfigService,
    );

    healthCheckMock.check.mockResolvedValue(healthy);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('reports ok with every component when all of them are up', async () => {
    const result = await service.check('en');

    expect(result.status).toBe('ok');
    expect(result.message).toBe('Service is healthy');
    expect(result.details).toEqual(healthy.details);
    expect(typeof result.uptime).toBe('number');
    expect(new Date(result.timestamp).toString()).not.toBe('Invalid Date');
  });

  it('pings the database with a timeout and Redis', async () => {
    healthCheckMock.check.mockImplementation(
      async (indicators: (() => Promise<unknown>)[]) => {
        await Promise.all(indicators.map((indicator) => indicator()));

        return healthy;
      },
    );

    await service.check('en');

    expect(databaseMock.pingCheck).toHaveBeenCalledWith('database', {
      timeout: expect.any(Number) as number,
    });
    expect(redisMock.pingCheck).toHaveBeenCalledWith('redis');
  });

  it('throws the failing components as a 503 body', async () => {
    healthCheckMock.check.mockRejectedValue(
      new ServiceUnavailableException(redisDown),
    );

    const error = await failure();

    expect(error.getStatus()).toBe(503);
    expect(error.health.status).toBe('error');
    expect(error.health.message).toBe(
      'One or more dependencies are unavailable',
    );
    expect(error.health.details.redis).toEqual({
      status: 'down',
      message: 'connection refused',
    });
  });

  it('lets an unexpected failure through', async () => {
    healthCheckMock.check.mockRejectedValue(new Error('bug'));

    await expect(service.check('en')).rejects.toThrow('bug');
  });

  describe('language', () => {
    it('localises the message', async () => {
      expect((await service.check('vi')).message).toBe(
        'Dịch vụ đang hoạt động bình thường',
      );
    });

    it('collapses a regional variant onto its base language', async () => {
      expect((await service.check('vi-VN')).message).toBe(
        'Dịch vụ đang hoạt động bình thường',
      );
    });

    it('falls back to the configured language for an unsupported one', async () => {
      expect((await service.check('fr')).message).toBe('Service is healthy');
    });

    it('falls back to the default language without configuration', async () => {
      configMock.get.mockReturnValueOnce({});

      expect((await service.check('fr')).message).toBe('Service is healthy');
    });
  });
});
