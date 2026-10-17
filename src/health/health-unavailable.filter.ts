import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { Response } from 'express';

import { HealthUnavailableException } from './health-unavailable.exception';

@Catch(HealthUnavailableException)
export class HealthUnavailableFilter implements ExceptionFilter {
  catch(exception: HealthUnavailableException, host: ArgumentsHost): void {
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(exception.getStatus())
      .json(exception.health);
  }
}
