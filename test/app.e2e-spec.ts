import request from 'supertest';

import { HealthResponseDto } from '../src/dto/health-response.dto';
import { TestContext } from './support/interfaces/test-context.interface';
import { createTestApp } from './support/test-app';
import {
  API_BASE_PATH,
  HEALTH_PATH,
  SWAGGER_PATH,
} from './support/test.constants';

interface OpenApiDocument {
  info: { title: string; version: string };
  paths: Record<string, unknown>;
}

const EN_HEALTH = 'Service is healthy';
const VI_HEALTH = 'Dịch vụ đang hoạt động bình thường';

describe('App (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    // `swagger: true` because this file is the one that asserts the OpenAPI
    // document; every other spec skips building it.
    ctx = await createTestApp({ swagger: true });
  });

  afterAll(async () => {
    await ctx.close();
  });

  const getHealth = async (query = ''): Promise<HealthResponseDto> => {
    const response = await request(ctx.server()).get(`${HEALTH_PATH}${query}`);

    expect(response.status).toBe(200);

    return response.body as HealthResponseDto;
  };

  const getHealthWithHeader = async (
    header: string,
    value: string,
  ): Promise<HealthResponseDto> => {
    const response = await request(ctx.server())
      .get(HEALTH_PATH)
      .set(header, value)
      .expect(200);

    return response.body as HealthResponseDto;
  };

  describe('GET /health', () => {
    it('reports the service as healthy', async () => {
      const body = await getHealth();

      expect(body.status).toBe('ok');
      expect(body.message).toBe(EN_HEALTH);
      expect(typeof body.uptime).toBe('number');
      expect(new Date(body.timestamp).toString()).not.toBe('Invalid Date');
    });

    it('is served outside the versioned prefix', async () => {
      // The Docker health check polls this path; it must not move with the
      // API version.
      await request(ctx.server())
        .get(`${API_BASE_PATH}${HEALTH_PATH}`)
        .expect(404);
    });
  });

  describe('language resolution', () => {
    it('answers in Vietnamese for the `lang` query parameter', async () => {
      expect((await getHealth('?lang=vi')).message).toBe(VI_HEALTH);
    });

    it('supports the short `l` query alias', async () => {
      expect((await getHealth('?l=vi')).message).toBe(VI_HEALTH);
    });

    it('answers in Vietnamese for the `x-lang` header', async () => {
      expect((await getHealthWithHeader('x-lang', 'vi')).message).toBe(
        VI_HEALTH,
      );
    });

    it('resolves the regional variant `vi-VN` onto `vi`', async () => {
      expect(
        (await getHealthWithHeader('Accept-Language', 'vi-VN')).message,
      ).toBe(VI_HEALTH);
    });

    it('honours a realistic browser Accept-Language header', async () => {
      const body = await getHealthWithHeader(
        'Accept-Language',
        'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
      );

      expect(body.message).toBe(VI_HEALTH);
    });

    it('serves English for an English regional variant', async () => {
      expect(
        (await getHealthWithHeader('Accept-Language', 'en-GB')).message,
      ).toBe(EN_HEALTH);
    });

    it('falls back to English for an unsupported language', async () => {
      expect((await getHealth('?lang=fr')).message).toBe(EN_HEALTH);
    });

    it('rejects an unknown query parameter', async () => {
      // `forbidNonWhitelisted` is what forces every query DTO to declare
      // `lang` and `l`; this is the case that proves it is switched on.
      await request(ctx.server())
        .get(`${HEALTH_PATH}?unexpected=1`)
        .expect(400);
    });
  });

  describe('swagger', () => {
    it('serves the UI', async () => {
      await request(ctx.server())
        .get(SWAGGER_PATH)
        .expect(200)
        .expect('Content-Type', /text\/html/);
    });

    it('serves the OpenAPI JSON document', async () => {
      const response = await request(ctx.server())
        .get(`${SWAGGER_PATH}-json`)
        .expect(200);

      const document = response.body as OpenApiDocument;

      expect(document.info.title).toBeDefined();
      expect(document.paths[HEALTH_PATH]).toBeDefined();
      expect(document.paths[`${API_BASE_PATH}/auth/login`]).toBeDefined();
    });

    it('advertises en and vi as the supported languages', async () => {
      const response = await request(ctx.server())
        .get(`${SWAGGER_PATH}-json`)
        .expect(200);

      expect(JSON.stringify(response.body)).toContain('"enum":["en","vi"]');
    });
  });
});
