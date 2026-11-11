import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import { I18nService } from 'nestjs-i18n';

import { MONTHS_PER_YEAR } from '../../common/constants/time';
import { PaymentProvider } from '../enums/payment-provider.enum';
import {
  GatewayFailure,
  PaymentGateway,
} from '../interfaces/payment-gateway.interface';
import { PaymentWebhooksService } from '../payment-webhooks.service';
import { PAYMENT_GATEWAY } from '../payments.constants';
import { MockIntentStatus } from './enums/mock-intent-status.enum';
import { MockIntent } from './interfaces/mock-intent.interface';
import {
  CardAuthentication,
  CardConfirmation,
} from './interfaces/simulator-input.interface';
import { MockIntentStore } from './mock-intent.store';
import { MockPaymentGateway } from './mock-payment.gateway';
import {
  CARD_LAST4_DIGITS,
  MOCK_DECLINES,
  MOCK_EVENT_TYPES,
  MOCK_TEST_CARDS,
  MockTestCard,
  UNKNOWN_TEST_CARD,
} from './payment-simulator.constants';

@Injectable()
export class PaymentSimulatorService {
  constructor(
    @Inject(PAYMENT_GATEWAY) private readonly active: PaymentGateway,
    private readonly mock: MockPaymentGateway,
    private readonly store: MockIntentStore,
    private readonly webhooks: PaymentWebhooksService,
    private readonly i18n: I18nService,
  ) {}

  async confirm(id: string, input: CardConfirmation): Promise<MockIntent> {
    const intent = await this.findAwaiting(
      id,
      input.clientSecret,
      MockIntentStatus.RequiresPaymentMethod,
    );
    const card = testCardFor(input, new Date());

    return this.advance(
      {
        ...intent,
        card: {
          brand: card.brand,
          last4: input.cardNumber.slice(-CARD_LAST4_DIGITS),
        },
      },
      card.next,
      card.failure,
    );
  }

  async authenticate(
    id: string,
    { clientSecret, approve }: CardAuthentication,
  ): Promise<MockIntent> {
    const intent = await this.findAwaiting(
      id,
      clientSecret,
      MockIntentStatus.RequiresAction,
    );

    return approve
      ? this.advance(intent, MockIntentStatus.Succeeded, null)
      : this.advance(
          intent,
          MockIntentStatus.Failed,
          MOCK_DECLINES.authenticationFailed,
        );
  }

  private async advance(
    intent: MockIntent,
    status: MockIntentStatus,
    failure: GatewayFailure | null,
  ): Promise<MockIntent> {
    const next: MockIntent = { ...intent, status, failure };
    const { rawBody, signature } = this.mock.sign(
      next,
      MOCK_EVENT_TYPES[status] as string,
    );

    await this.webhooks.receive(PaymentProvider.Mock, rawBody, signature);

    return this.store.save(next);
  }

  private async findAwaiting(
    id: string,
    clientSecret: string,
    expected: MockIntentStatus,
  ): Promise<MockIntent> {
    if (this.active.provider !== PaymentProvider.Mock) {
      throw new NotFoundException(this.i18n.t('payments.SIMULATOR_DISABLED'));
    }

    const intent = await this.store.find(id);

    if (!intent || !sameSecret(intent.clientSecret, clientSecret)) {
      throw new NotFoundException(this.i18n.t('payments.INTENT_NOT_FOUND'));
    }

    if (intent.status !== expected) {
      throw new ConflictException(
        this.i18n.t('payments.INTENT_NOT_AWAITING', {
          args: { status: intent.status },
        }),
      );
    }

    return intent;
  }
}

function testCardFor(input: CardConfirmation, now: Date): MockTestCard {
  const card = MOCK_TEST_CARDS[input.cardNumber] ?? UNKNOWN_TEST_CARD;
  const expiry = input.expYear * MONTHS_PER_YEAR + input.expMonth;
  const current = now.getFullYear() * MONTHS_PER_YEAR + now.getMonth() + 1;

  return expiry < current
    ? {
        ...card,
        next: MockIntentStatus.Failed,
        failure: MOCK_DECLINES.expiredCard,
      }
    : card;
}

function sameSecret(expected: string, received: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(received);

  return a.length === b.length && timingSafeEqual(a, b);
}
