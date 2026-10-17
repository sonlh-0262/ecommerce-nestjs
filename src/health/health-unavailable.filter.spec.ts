import { ArgumentsHost } from '@nestjs/common';

import { HealthResponseDto } from './dto/health-response.dto';
import { HealthUnavailableException } from './health-unavailable.exception';
import { HealthUnavailableFilter } from './health-unavailable.filter';

describe('HealthUnavailableFilter', () => {
  it('renders the health body with 503', () => {
    const health: HealthResponseDto = {
      status: 'error',
      message: 'One or more dependencies are unavailable',
      uptime: 1,
      timestamp: '2026-01-01T00:00:00.000Z',
      details: { database: { status: 'down', message: 'timeout' } },
    };
    const response = { status: jest.fn(), json: jest.fn() };
    response.status.mockReturnValue(response);
    const host = {
      switchToHttp: () => ({ getResponse: () => response }),
    } as unknown as ArgumentsHost;

    new HealthUnavailableFilter().catch(
      new HealthUnavailableException(health),
      host,
    );

    expect(response.status).toHaveBeenCalledWith(503);
    expect(response.json).toHaveBeenCalledWith(health);
  });
});
