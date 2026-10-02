import { INestApplication } from '@nestjs/common';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';

import { UserFactory } from '../factories/user.factory';

/** Everything a spec needs from a booted application. */
export interface TestContext {
  app: INestApplication<App>;
  dataSource: DataSource;
  /** Seeds accounts without going through the API. */
  users: UserFactory;
  /** HTTP server to hand to `supertest`. */
  server: () => App;
  /** Empties every store the suite owns; call between cases. */
  reset: () => Promise<void>;
  close: () => Promise<void>;
}
