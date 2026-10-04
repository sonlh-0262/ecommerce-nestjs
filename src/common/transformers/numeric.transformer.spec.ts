import { numericTransformer } from './numeric.transformer';

describe('numericTransformer', () => {
  it('turns the driver string into a number', () => {
    expect(numericTransformer.from('42980000')).toBe(42980000);
    expect(numericTransformer.from('4.60')).toBe(4.6);
  });

  it('keeps null as null', () => {
    expect(numericTransformer.from(null)).toBeNull();
  });

  it('makes sums add instead of concatenate', () => {
    const subtotal = numericTransformer.from('42980000') as number;
    const shippingFee = numericTransformer.from('30000') as number;

    expect(subtotal + shippingFee).toBe(43010000);
  });

  it('passes values through unchanged on write', () => {
    expect(numericTransformer.to(30000)).toBe(30000);
    expect(numericTransformer.to(null)).toBeNull();
  });
});
