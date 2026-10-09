import { Logger } from '@nestjs/common';
import { CommandFactory } from 'nest-commander';

import {
  CONSOLE_LOG_LEVELS,
  CONSOLE_LOGGER_CONTEXT,
} from './console.constants';
import { ConsoleModule } from './console.module';

const logger = new Logger(CONSOLE_LOGGER_CONTEXT);

function fail(error: Error): void {
  logger.error(error.message, error.stack);
  process.exitCode = 1;
}

CommandFactory.run(ConsoleModule, {
  logger: CONSOLE_LOG_LEVELS,
  serviceErrorHandler: fail,
}).catch(fail);
