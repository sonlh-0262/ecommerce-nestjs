import request from 'supertest';

import { bearer, errorMessages, loginRequest } from './support/http';
import { TestContext } from './support/interfaces/test-context.interface';
import { createTestApp } from './support/test-app';
import {
  API_BASE_PATH,
  AUTH_PATHS,
  HEALTH_PATH,
  SEEDED_USER_PASSWORD,
} from './support/test.constants';

describe('Security and error handling (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  afterEach(async () => {
    await ctx.reset();
  });

  describe('global authentication', () => {
    it('closes a route that is not marked public', async () => {
      const response = await request(ctx.server())
        .post(AUTH_PATHS.logout)
        .expect(401);

      expect(errorMessages(response.body)).toEqual([
        'Authentication is required to access this resource',
      ]);
    });

    it('lets a valid token through', async () => {
      const { session } = await ctx.users.createAuthenticated();

      await request(ctx.server())
        .post(AUTH_PATHS.logout)
        .set(...bearer(session.token))
        .expect(200);
    });

    it('keeps the health probe open', async () => {
      await request(ctx.server()).get(HEALTH_PATH).expect(200);
    });

    it('localises the 401', async () => {
      const response = await request(ctx.server())
        .post(`${AUTH_PATHS.logout}?lang=vi`)
        .expect(401);

      expect(errorMessages(response.body)).toEqual([
        'Bạn cần đăng nhập để truy cập tài nguyên này',
      ]);
    });
  });

  describe('error envelope', () => {
    it('renders a validation failure as { errors: { body } }', async () => {
      const response = await loginRequest(
        ctx.server(),
        'not-an-email',
        '',
      ).expect(400);

      expect(Object.keys(response.body as object)).toEqual(['errors']);
      expect(errorMessages(response.body)).toHaveLength(2);
    });

    it('renders an unknown route the same way', async () => {
      const response = await request(ctx.server())
        .get(`${API_BASE_PATH}/no-such-route`)
        .expect(404);

      expect(errorMessages(response.body)).toHaveLength(1);
    });

    it('answers malformed JSON with 400', async () => {
      const response = await request(ctx.server())
        .post(AUTH_PATHS.login)
        .set('Content-Type', 'application/json')
        .send('{"user": ')
        .expect(400);

      expect(errorMessages(response.body)).toHaveLength(1);
    });
  });

  it('answers a body over the parser limit with a translated 413', async () => {
    const response = await loginRequest(
      ctx.server(),
      'a@example.com',
      'x'.repeat(200_000),
      '?lang=vi',
    ).expect(413);

    expect(errorMessages(response.body)).toEqual(['Nội dung yêu cầu quá lớn']);
  });

  describe('login rate limit', () => {
    it('refuses the sixth attempt for one email within the window', async () => {
      const user = await ctx.users.create();
      const attempt = () =>
        loginRequest(ctx.server(), user.email, 'WrongPassword1');

      for (let sent = 1; sent <= 5; sent += 1) {
        await attempt().expect(401);
      }

      const response = await attempt().expect(429);

      expect(errorMessages(response.body)).toEqual([
        'Too many requests, please try again later',
      ]);
      expect(response.headers['retry-after']).toBeDefined();
    });

    it('counts each email on its own', async () => {
      const [locked, other] = [
        await ctx.users.create(),
        await ctx.users.create(),
      ];

      for (let sent = 1; sent <= 5; sent += 1) {
        await loginRequest(ctx.server(), locked.email, 'WrongPassword1');
      }

      await loginRequest(
        ctx.server(),
        other.email,
        SEEDED_USER_PASSWORD,
      ).expect(200);
    });
  });
});
