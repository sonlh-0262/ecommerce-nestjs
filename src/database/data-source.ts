import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';

import databaseConfig from '../config/database.config';
import { envFilePaths } from '../config/env-files';
import { buildDataSourceOptions } from './data-source-options';

// The CLI runs outside Nest, so nothing else has loaded the environment yet.
loadEnv({ path: envFilePaths(), quiet: true });

export default new DataSource(buildDataSourceOptions(databaseConfig()));
