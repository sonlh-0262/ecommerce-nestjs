import { ApiProperty } from '@nestjs/swagger';

import { MockIntentStatus } from '../enums/mock-intent-status.enum';
import { MockIntent } from '../interfaces/mock-intent.interface';
import { MOCK_NEXT_ACTION } from '../payment-simulator.constants';

export class SimulatedIntentDto {
  @ApiProperty({ example: 'mock_pi_3f9a1c0d2b7e4a5f6c8d9e0a' })
  id: string;

  @ApiProperty({ enum: MockIntentStatus, enumName: 'MockIntentStatus' })
  status: MockIntentStatus;

  @ApiProperty({ description: 'In VND.', example: 330000 })
  amount: number;

  @ApiProperty({ example: 'VND' })
  currency: string;

  @ApiProperty({
    nullable: true,
    enum: [MOCK_NEXT_ACTION],
    description: 'AUTHENTICATE when the card asks for 3D Secure.',
  })
  nextAction: typeof MOCK_NEXT_ACTION | null;

  @ApiProperty({ nullable: true, example: null })
  failureCode: string | null;

  @ApiProperty({ nullable: true, example: null })
  failureMessage: string | null;
}

export class SimulatedIntentResponseDto {
  @ApiProperty({ type: SimulatedIntentDto })
  intent: SimulatedIntentDto;
}

export function toSimulatedIntentResponse(
  intent: MockIntent,
): SimulatedIntentResponseDto {
  return {
    intent: {
      id: intent.id,
      status: intent.status,
      amount: intent.amount,
      currency: intent.currency,
      nextAction:
        intent.status === MockIntentStatus.RequiresAction
          ? MOCK_NEXT_ACTION
          : null,
      failureCode: intent.failure?.code ?? null,
      failureMessage: intent.failure?.message ?? null,
    },
  };
}
