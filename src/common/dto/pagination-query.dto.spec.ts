import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import {
  DEFAULT_LIMIT,
  DEFAULT_OFFSET,
  MAX_LIMIT,
} from '../constants/pagination';
import { PaginationQueryDto } from './pagination-query.dto';

describe('PaginationQueryDto', () => {
  const parse = (query: Record<string, string>) => {
    const dto = plainToInstance(PaginationQueryDto, query, {
      enableImplicitConversion: true,
    });

    return { dto, errors: validateSync(dto) };
  };

  it('defaults both bounds when the query names neither', () => {
    const { dto, errors } = parse({});

    expect(errors).toHaveLength(0);
    expect(dto.limit).toBe(DEFAULT_LIMIT);
    expect(dto.offset).toBe(DEFAULT_OFFSET);
  });

  it('converts the strings a query string carries', () => {
    const { dto, errors } = parse({ limit: '5', offset: '10' });

    expect(errors).toHaveLength(0);
    expect(dto.limit).toBe(5);
    expect(dto.offset).toBe(10);
  });

  it('accepts the largest page', () => {
    expect(parse({ limit: String(MAX_LIMIT) }).errors).toHaveLength(0);
  });

  it.each([
    ['a limit of zero', { limit: '0' }],
    ['a limit above the maximum', { limit: String(MAX_LIMIT + 1) }],
    ['a negative offset', { offset: '-1' }],
    ['a fractional limit', { limit: '2.5' }],
    ['a limit that is not a number', { limit: 'ten' }],
  ])('rejects %s', (_case, query) => {
    expect(parse(query).errors).not.toHaveLength(0);
  });
});
