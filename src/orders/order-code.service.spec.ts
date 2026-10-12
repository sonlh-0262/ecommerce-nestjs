import { ConflictException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { EntityManager } from 'typeorm';

import { OrderCodeCounter } from './entities/order-code-counter.entity';
import { OrderCodeService } from './order-code.service';

describe('OrderCodeService', () => {
  const NOW = new Date('2026-10-05T03:00:00.000Z');

  const builder = {
    insert: jest.fn().mockReturnThis(),
    into: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    orIgnore: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    returning: jest.fn().mockReturnThis(),
    execute: jest.fn(),
  };
  const manager = {
    createQueryBuilder: jest.fn(() => builder),
  } as unknown as EntityManager;
  const i18nMock = { t: jest.fn((key: string) => key) };

  const service = new OrderCodeService(i18nMock as unknown as I18nService);

  const nextSeq = (seq: number) =>
    builder.execute
      .mockResolvedValueOnce({ raw: [] })
      .mockResolvedValueOnce({ raw: [{ last_seq: seq }] });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('formats the code as ORD-yyyyMMdd-0001', async () => {
    nextSeq(1);

    await expect(service.next(manager, NOW)).resolves.toBe('ORD-20261005-0001');
  });

  it('pads the sequence to exactly four digits', async () => {
    nextSeq(42);

    await expect(service.next(manager, NOW)).resolves.toBe('ORD-20261005-0042');
  });

  it('accepts the last sequence of the day', async () => {
    nextSeq(9999);

    await expect(service.next(manager, NOW)).resolves.toBe('ORD-20261005-9999');
  });

  it('refuses sequence 10000 instead of growing past the column', async () => {
    nextSeq(10000);

    await expect(service.next(manager, NOW)).rejects.toThrow(
      new ConflictException('orders.CODE_SEQUENCE_EXHAUSTED'),
    );
  });

  it("creates the day's counter if missing, then bumps it in one statement", async () => {
    nextSeq(1);

    await service.next(manager, NOW);

    expect(builder.into).toHaveBeenCalledWith(OrderCodeCounter);
    expect(builder.values).toHaveBeenCalledWith({ orderDate: '2026-10-05' });
    expect(builder.orIgnore).toHaveBeenCalled();
    expect(builder.update).toHaveBeenCalledWith(OrderCodeCounter);
    expect(builder.where).toHaveBeenCalledWith('order_date = :orderDate', {
      orderDate: '2026-10-05',
    });
    expect(builder.returning).toHaveBeenCalledWith('last_seq');
  });

  it('counts days in Vietnam time, not UTC', async () => {
    nextSeq(1);
    nextSeq(1);

    await expect(
      service.next(manager, new Date('2026-10-04T17:30:00.000Z')),
    ).resolves.toBe('ORD-20261005-0001');
    await expect(
      service.next(manager, new Date('2026-10-04T16:59:59.000Z')),
    ).resolves.toBe('ORD-20261004-0001');
  });
});
