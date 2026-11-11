import { SECONDS_PER_DAY } from '../../common/constants/time';
import { GatewayFailure } from '../interfaces/payment-gateway.interface';
import { MockIntentStatus } from './enums/mock-intent-status.enum';

export const MOCK_INTENT_KEY_PREFIX = 'payments:mock-intent:';
export const MOCK_INTENT_TTL_DAYS = 30;
export const MOCK_INTENT_TTL_SECONDS = MOCK_INTENT_TTL_DAYS * SECONDS_PER_DAY;
export const MOCK_STORE_TIMEOUT_MS = 1000;

export const MOCK_INTENT_ID_PREFIX = 'mock_pi_';
export const MOCK_SECRET_INFIX = '_secret_';
export const MOCK_EVENT_ID_PREFIX = 'mock_evt_';
export const MOCK_REFUND_ID_PREFIX = 'mock_re_';
export const MOCK_ID_BYTES = 12;
export const MOCK_SECRET_BYTES = 16;

export const CARD_NUMBER_MAX_LENGTH = 19;
export const CVC_PATTERN = /^\d{3,4}$/;
export const MIN_EXP_YEAR = 2000;
export const MAX_EXP_YEAR = 2100;
export const CARD_LAST4_DIGITS = 4;
export const CARD_NUMBER_SEPARATORS = /[\s-]/g;

export const WEBHOOK_SIGNATURE_KEYS = {
  timestamp: 't',
  signature: 'v1',
} as const;

export const MOCK_DECLINES = {
  cardDeclined: { code: 'card_declined', message: 'Your card was declined.' },
  insufficientFunds: {
    code: 'insufficient_funds',
    message: 'Your card has insufficient funds.',
  },
  expiredCard: { code: 'expired_card', message: 'Your card has expired.' },
  incorrectCvc: {
    code: 'incorrect_cvc',
    message: "Your card's security code is incorrect.",
  },
  authenticationFailed: {
    code: 'authentication_failed',
    message: 'The cardholder did not complete 3D Secure authentication.',
  },
} satisfies Record<string, GatewayFailure>;

export interface MockTestCard {
  brand: string;
  next: MockIntentStatus;
  failure: GatewayFailure | null;
}

const approved = (brand: string): MockTestCard => ({
  brand,
  next: MockIntentStatus.Succeeded,
  failure: null,
});

const declined = (failure: GatewayFailure): MockTestCard => ({
  brand: 'visa',
  next: MockIntentStatus.Failed,
  failure,
});

export const MOCK_TEST_CARDS: Readonly<Record<string, MockTestCard>> = {
  '4242424242424242': approved('visa'),
  '5555555555554444': approved('mastercard'),
  '4000002500003155': {
    brand: 'visa',
    next: MockIntentStatus.RequiresAction,
    failure: null,
  },
  '4000000000000002': declined(MOCK_DECLINES.cardDeclined),
  '4000000000009995': declined(MOCK_DECLINES.insufficientFunds),
  '4000000000000069': declined(MOCK_DECLINES.expiredCard),
  '4000000000000127': declined(MOCK_DECLINES.incorrectCvc),
};

export const UNKNOWN_TEST_CARD: MockTestCard = {
  brand: 'unknown',
  next: MockIntentStatus.Failed,
  failure: MOCK_DECLINES.cardDeclined,
};

export const MOCK_EVENT_TYPES: Readonly<
  Partial<Record<MockIntentStatus, string>>
> = {
  [MockIntentStatus.RequiresAction]: 'payment_intent.requires_action',
  [MockIntentStatus.Succeeded]: 'payment_intent.succeeded',
  [MockIntentStatus.Failed]: 'payment_intent.payment_failed',
};

export const MOCK_NEXT_ACTION = 'AUTHENTICATE';
