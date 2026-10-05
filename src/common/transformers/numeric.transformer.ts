import { ValueTransformer } from 'typeorm';

// pg returns bigint and numeric as strings, so money columns would concatenate.
export const numericTransformer: ValueTransformer = {
  to: (value: number | null | undefined) => value,
  from: (value: string | null): number | null =>
    value === null ? null : Number(value),
};
