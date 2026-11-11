import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';

import { ApiErrorResponse } from '../../common/decorators/api-error-response.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { RateLimit } from '../../common/throttling/rate-limit.decorator';
import { PAYMENTS_RATE_LIMITS } from '../payments.constants';
import { AuthenticateIntentDto } from './dto/authenticate-intent.dto';
import { ConfirmIntentDto } from './dto/confirm-intent.dto';
import {
  SimulatedIntentResponseDto,
  toSimulatedIntentResponse,
} from './dto/simulated-intent.dto';
import { PaymentSimulatorService } from './payment-simulator.service';

@ApiTags('Payment simulator')
@Public()
@RateLimit(PAYMENTS_RATE_LIMITS.simulate)
@ApiParam({ name: 'id', example: 'mock_pi_3f9a1c0d2b7e4a5f6c8d9e0a' })
@ApiOkResponse({ type: SimulatedIntentResponseDto })
@ApiErrorResponse(HttpStatus.BAD_REQUEST, 'The payload failed validation.')
@ApiErrorResponse(
  HttpStatus.NOT_FOUND,
  'The simulator is off, or no intent has this id and client secret.',
)
@ApiErrorResponse(
  HttpStatus.CONFLICT,
  'The intent is not waiting for this step.',
)
@ApiErrorResponse(HttpStatus.TOO_MANY_REQUESTS, 'Too many attempts.')
@Controller('payment-simulator/intents')
export class PaymentSimulatorController {
  constructor(private readonly simulator: PaymentSimulatorService) {}

  @Post(':id/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Pay a simulated intent with a test card',
    description:
      'Plays the part of Stripe.js against the built-in fake gateway: the ' +
      'test card decides the outcome and the gateway delivers a signed ' +
      'webhook to the API before answering. Only while PAYMENT_PROVIDER=mock.',
  })
  async confirm(
    @Param('id') id: string,
    @Body() dto: ConfirmIntentDto,
  ): Promise<SimulatedIntentResponseDto> {
    return toSimulatedIntentResponse(
      await this.simulator.confirm(id, dto.confirmation),
    );
  }

  @Post(':id/authenticate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Complete or fail the 3D Secure step of a simulated intent',
  })
  async authenticate(
    @Param('id') id: string,
    @Body() dto: AuthenticateIntentDto,
  ): Promise<SimulatedIntentResponseDto> {
    return toSimulatedIntentResponse(
      await this.simulator.authenticate(id, dto.authentication),
    );
  }
}
