import { Payment } from '../entities/payment.entity';
import { PaymentAttemptStatus } from '../enums/payment-attempt-status.enum';
import { PaymentProvider } from '../enums/payment-provider.enum';
import { toPaymentResponse, toPaymentsResponse } from './payment.dto';

describe('payment mappers', () => {
  const CREATED_AT = new Date('2026-11-10T03:00:00.000Z');
  const SUCCEEDED_AT = new Date('2026-11-10T03:01:00.000Z');

  const payment = (overrides: Partial<Payment> = {}): Payment =>
    ({
      id: 'pay1',
      orderId: 'o1',
      provider: PaymentProvider.Mock,
      providerPaymentId: 'mock_pi_1',
      clientSecret: 'mock_pi_1_secret_1',
      status: PaymentAttemptStatus.Pending,
      amount: 330000,
      currency: 'VND',
      cardBrand: null,
      cardLast4: null,
      failureCode: null,
      failureMessage: null,
      providerRefundId: 'mock_re_1',
      succeededAt: null,
      refundedAt: null,
      createdAt: CREATED_AT,
      ...overrides,
    }) as Payment;

  it('hands out the client secret while the attempt is open', () => {
    expect(toPaymentResponse(payment())).toEqual({
      payment: {
        id: 'pay1',
        provider: PaymentProvider.Mock,
        providerPaymentId: 'mock_pi_1',
        status: PaymentAttemptStatus.Pending,
        amount: 330000,
        currency: 'VND',
        clientSecret: 'mock_pi_1_secret_1',
        cardBrand: null,
        cardLast4: null,
        failureCode: null,
        failureMessage: null,
        createdAt: '2026-11-10T03:00:00.000Z',
        succeededAt: null,
        refundedAt: null,
      },
    });
  });

  it.each([
    PaymentAttemptStatus.Succeeded,
    PaymentAttemptStatus.Failed,
    PaymentAttemptStatus.RefundPending,
    PaymentAttemptStatus.Refunded,
  ])('hides the client secret once %s', (status) => {
    expect(toPaymentResponse(payment({ status })).payment.clientSecret).toBe(
      null,
    );
  });

  it('dates a successful and refunded attempt', () => {
    const { payment: dto } = toPaymentResponse(
      payment({
        status: PaymentAttemptStatus.Refunded,
        succeededAt: SUCCEEDED_AT,
        refundedAt: SUCCEEDED_AT,
        cardBrand: 'visa',
        cardLast4: '4242',
      }),
    );

    expect(dto).toMatchObject({
      succeededAt: '2026-11-10T03:01:00.000Z',
      refundedAt: '2026-11-10T03:01:00.000Z',
      cardBrand: 'visa',
      cardLast4: '4242',
    });
    expect(dto).not.toHaveProperty('providerRefundId');
  });

  it('wraps a page with its total', () => {
    expect(
      toPaymentsResponse({ payments: [payment()], total: 3 }),
    ).toMatchObject({ payments: [{ id: 'pay1' }], paymentsCount: 3 });
  });
});
