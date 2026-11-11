import { PaymentAttemptStatus } from './enums/payment-attempt-status.enum';
import { OPEN_PAYMENT_STATUSES } from './payments.constants';

export const PAYMENT_TRANSITIONS: Readonly<
  Record<PaymentAttemptStatus, readonly PaymentAttemptStatus[]>
> = {
  [PaymentAttemptStatus.Pending]: [
    PaymentAttemptStatus.RequiresAction,
    PaymentAttemptStatus.Succeeded,
    PaymentAttemptStatus.Failed,
  ],
  [PaymentAttemptStatus.RequiresAction]: [
    PaymentAttemptStatus.Succeeded,
    PaymentAttemptStatus.Failed,
  ],
  [PaymentAttemptStatus.Failed]: [PaymentAttemptStatus.Succeeded],
  [PaymentAttemptStatus.Succeeded]: [PaymentAttemptStatus.RefundPending],
  [PaymentAttemptStatus.RefundPending]: [PaymentAttemptStatus.Refunded],
  [PaymentAttemptStatus.Refunded]: [],
};

export function canMovePayment(
  from: PaymentAttemptStatus,
  to: PaymentAttemptStatus,
): boolean {
  return PAYMENT_TRANSITIONS[from].includes(to);
}

export function isOpenPayment(status: PaymentAttemptStatus): boolean {
  return OPEN_PAYMENT_STATUSES.includes(status);
}
