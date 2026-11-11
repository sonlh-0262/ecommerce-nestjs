import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import { ConfirmIntentDto } from './confirm-intent.dto';

describe('ConfirmIntentDto', () => {
  const body = (overrides: Record<string, unknown> = {}) => ({
    confirmation: {
      clientSecret: 'mock_pi_1_secret_1',
      cardNumber: '4242 4242 4242 4242',
      expMonth: 12,
      expYear: 2030,
      cvc: '123',
      ...overrides,
    },
  });

  const errorsOf = (value: object) =>
    validateSync(plainToInstance(ConfirmIntentDto, value)).flatMap((error) =>
      (error.children ?? []).map((child) => child.property),
    );

  it('accepts a test card typed with spaces or dashes', () => {
    expect(errorsOf(body())).toEqual([]);
    expect(errorsOf(body({ cardNumber: '4000-0025-0000-3155' }))).toEqual([]);
  });

  it('strips the separators before the gateway sees the number', () => {
    expect(
      plainToInstance(ConfirmIntentDto, body()).confirmation.cardNumber,
    ).toBe('4242424242424242');
  });

  it.each([
    ['cardNumber', '4242424242424241'],
    ['cardNumber', '1234'],
    ['expMonth', 13],
    ['expMonth', 0],
    ['expYear', 1999],
    ['cvc', '12'],
    ['cvc', '12a'],
    ['clientSecret', ''],
  ])('rejects %s = %p', (field, value) => {
    expect(errorsOf(body({ [field]: value }))).toContain(field);
  });
});
