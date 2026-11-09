import { ConfigService } from '@nestjs/config';
import request from 'supertest';

import {
  BULL_BOARD_CONFIG_KEY,
  BullBoardConfig,
} from '../src/config/bull-board.config';
import { MAIL_QUEUE } from '../src/mail/mail.constants';
import { TestContext } from './support/interfaces/test-context.interface';
import { createTestApp } from './support/test-app';
import { API_BASE_PATH } from './support/test.constants';

const QUEUE_BOARD_PATH = `${API_BASE_PATH}/queues`;

interface QueuesResponse {
  queues: { name: string }[];
}

describe('Queue board (e2e)', () => {
  let ctx: TestContext;
  let account: BullBoardConfig;

  beforeAll(async () => {
    ctx = await createTestApp();
    account = ctx.app
      .get(ConfigService)
      .getOrThrow<BullBoardConfig>(BULL_BOARD_CONFIG_KEY);
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('asks the browser for credentials', async () => {
    const response = await request(ctx.server())
      .get(QUEUE_BOARD_PATH)
      .expect(401);

    expect(response.headers['www-authenticate']).toContain('Basic');
  });

  it('refuses a wrong password', async () => {
    await request(ctx.server())
      .get(QUEUE_BOARD_PATH)
      .auth(account.username, 'wrong-password')
      .expect(401);
  });

  it('serves the dashboard to the configured account', async () => {
    const response = await request(ctx.server())
      .get(QUEUE_BOARD_PATH)
      .auth(account.username, account.password)
      .expect(200);

    expect(response.headers['content-type']).toContain('text/html');
  });

  it('lists the mail queue', async () => {
    const response = await request(ctx.server())
      .get(`${QUEUE_BOARD_PATH}/api/queues`)
      .auth(account.username, account.password)
      .expect(200);

    const { queues } = response.body as QueuesResponse;

    expect(queues.map(({ name }) => name)).toContain(MAIL_QUEUE);
  });
});
