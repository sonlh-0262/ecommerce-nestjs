import { INestApplication } from '@nestjs/common';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';

import { CatalogFactory } from '../factories/catalog.factory';
import { UserFactory } from '../factories/user.factory';
import { MailRecorder } from '../mail-recorder';

/** Everything a spec needs from a booted application. */
export interface TestContext {
  app: INestApplication<App>;
  dataSource: DataSource;
  /** Seeds accounts without going through the API. */
  users: UserFactory;
  catalog: CatalogFactory;
  mail: MailRecorder;
  storedFiles: () => Promise<string[]>;
  /** HTTP server to hand to `supertest`. */
  server: () => App;
  /** Empties every store the suite owns; call between cases. */
  reset: () => Promise<void>;
  close: () => Promise<void>;
}
