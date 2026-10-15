import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import { OrderStatus } from '../enums/order-status.enum';
import { REASON_MAX_LENGTH, REASON_MIN_LENGTH } from '../orders.constants';
import { UpdateOrderStatusDto } from './update-order-status.dto';

describe('UpdateOrderStatusDto', () => {
  const parse = (order: Record<string, unknown>) => {
    const dto = plainToInstance(UpdateOrderStatusDto, { order });

    return { dto, errors: validateSync(dto) };
  };

  it.each([
    OrderStatus.Confirmed,
    OrderStatus.Shipping,
    OrderStatus.Delivered,
    OrderStatus.Rejected,
  ])('accepts %s without a reason', (status) => {
    expect(parse({ status }).errors).toHaveLength(0);
  });

  it.each([OrderStatus.Pending, OrderStatus.Cancelled, 'SHIPPED'])(
    'refuses %s, which an admin cannot set',
    (status) => {
      expect(parse({ status }).errors).toHaveLength(1);
    },
  );

  it.each([
    ['one character short', 'x'.repeat(REASON_MIN_LENGTH - 1)],
    ['one character too long', 'x'.repeat(REASON_MAX_LENGTH + 1)],
  ])('refuses a reason %s', (_label, reason) => {
    expect(parse({ status: OrderStatus.Rejected, reason }).errors).toHaveLength(
      1,
    );
  });

  it('trims the reason before measuring it', () => {
    const { dto, errors } = parse({
      status: OrderStatus.Rejected,
      reason: `  ${'x'.repeat(REASON_MIN_LENGTH)}  `,
    });

    expect(errors).toHaveLength(0);
    expect(dto.order.reason).toBe('x'.repeat(REASON_MIN_LENGTH));
  });

  it('turns a blank reason into none, left for the service to refuse', () => {
    const { dto, errors } = parse({
      status: OrderStatus.Rejected,
      reason: '   ',
    });

    expect(errors).toHaveLength(0);
    expect(dto.order.reason).toBeNull();
  });
});
