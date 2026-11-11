import { MockIntentStatus } from '../enums/mock-intent-status.enum';
import { MockIntent } from '../interfaces/mock-intent.interface';
import { toSimulatedIntentResponse } from './simulated-intent.dto';

describe('toSimulatedIntentResponse', () => {
  const intent = (overrides: Partial<MockIntent> = {}): MockIntent => ({
    id: 'mock_pi_1',
    clientSecret: 'mock_pi_1_secret_1',
    amount: 330000,
    currency: 'VND',
    orderCode: 'ORD-20261110-0001',
    status: MockIntentStatus.Succeeded,
    card: { brand: 'visa', last4: '4242' },
    failure: null,
    refundId: null,
    ...overrides,
  });

  it('never echoes the client secret', () => {
    expect(toSimulatedIntentResponse(intent())).toEqual({
      intent: {
        id: 'mock_pi_1',
        status: MockIntentStatus.Succeeded,
        amount: 330000,
        currency: 'VND',
        nextAction: null,
        failureCode: null,
        failureMessage: null,
      },
    });
  });

  it('asks for authentication on a 3D Secure card', () => {
    expect(
      toSimulatedIntentResponse(
        intent({ status: MockIntentStatus.RequiresAction }),
      ).intent.nextAction,
    ).toBe('AUTHENTICATE');
  });

  it('explains a decline', () => {
    expect(
      toSimulatedIntentResponse(
        intent({
          status: MockIntentStatus.Failed,
          failure: { code: 'card_declined', message: 'Declined.' },
        }),
      ).intent,
    ).toMatchObject({
      failureCode: 'card_declined',
      failureMessage: 'Declined.',
    });
  });
});
