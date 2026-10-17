import { ServiceUnavailableException } from '@nestjs/common';

import { HealthResponseDto } from './dto/health-response.dto';

export class HealthUnavailableException extends ServiceUnavailableException {
  constructor(readonly health: HealthResponseDto) {
    super(health);
  }
}
