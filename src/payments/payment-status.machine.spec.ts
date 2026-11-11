import { PaymentAttemptStatus } from './enums/payment-attempt-status.enum';
import {
  canMovePayment,
  isOpenPayment,
  PAYMENT_TRANSITIONS,
} from './payment-status.machine';

const ALL = Object.values(PaymentAttemptStatus);

const ALLOWED: [PaymentAttemptStatus, PaymentAttemptStatus][] = [
  [PaymentAttemptStatus.Pending, PaymentAttemptStatus.RequiresAction],
  [PaymentAttemptStatus.Pending, PaymentAttemptStatus.Succeeded],
  [PaymentAttemptStatus.Pending, PaymentAttemptStatus.Failed],
  [PaymentAttemptStatus.RequiresAction, PaymentAttemptStatus.Succeeded],
  [PaymentAttemptStatus.RequiresAction, PaymentAttemptStatus.Failed],
  [PaymentAttemptStatus.Failed, PaymentAttemptStatus.Succeeded],
  [PaymentAttemptStatus.Succeeded, PaymentAttemptStatus.RefundPending],
  [PaymentAttemptStatus.RefundPending, PaymentAttemptStatus.Refunded],
];

describe('payment status machine', () => {
  it('lists a rule for every status', () => {
    expect(Object.keys(PAYMENT_TRANSITIONS).sort()).toEqual([...ALL].sort());
  });

  it.each(ALL.flatMap((from) => ALL.map((to) => [from, to] as const)))(
    'moving %s -> %s matches the table',
    (from, to) => {
      const allowed = ALLOWED.some(([a, b]) => a === from && b === to);

      expect(canMovePayment(from, to)).toBe(allowed);
    },
  );

  it.each([
    [PaymentAttemptStatus.Pending, true],
    [PaymentAttemptStatus.RequiresAction, true],
    [PaymentAttemptStatus.Succeeded, false],
    [PaymentAttemptStatus.Failed, false],
    [PaymentAttemptStatus.RefundPending, false],
    [PaymentAttemptStatus.Refunded, false],
  ])('%s open = %s', (status, open) => {
    expect(isOpenPayment(status)).toBe(open);
  });
});
