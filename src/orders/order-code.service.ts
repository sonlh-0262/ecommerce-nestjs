import { ConflictException, Injectable } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { EntityManager } from 'typeorm';

import { OrderCodeCounter } from './entities/order-code-counter.entity';
import {
  ORDER_CODE_MAX_SEQ,
  ORDER_CODE_PREFIX,
  ORDER_CODE_SEQ_PADDING,
  ORDER_CODE_TIME_ZONE,
} from './orders.constants';

const ORDER_DATE_FORMAT = new Intl.DateTimeFormat('en-US', {
  timeZone: ORDER_CODE_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function orderDateOf(moment: Date): string {
  const parts = Object.fromEntries(
    ORDER_DATE_FORMAT.formatToParts(moment).map(({ type, value }) => [
      type,
      value,
    ]),
  );

  return `${parts.year}-${parts.month}-${parts.day}`;
}

@Injectable()
export class OrderCodeService {
  constructor(private readonly i18n: I18nService) {}

  async next(manager: EntityManager, now = new Date()): Promise<string> {
    const orderDate = orderDateOf(now);

    await manager
      .createQueryBuilder()
      .insert()
      .into(OrderCodeCounter)
      .values({ orderDate })
      .orIgnore()
      .execute();

    const bumped = await manager
      .createQueryBuilder()
      .update(OrderCodeCounter)
      .set({ lastSeq: () => 'last_seq + 1' })
      .where('order_date = :orderDate', { orderDate })
      .returning('last_seq')
      .execute();
    const [{ last_seq: seq }] = bumped.raw as { last_seq: number }[];

    if (seq > ORDER_CODE_MAX_SEQ) {
      throw new ConflictException(
        this.i18n.t('orders.CODE_SEQUENCE_EXHAUSTED'),
      );
    }

    return [
      ORDER_CODE_PREFIX,
      orderDate.replaceAll('-', ''),
      String(seq).padStart(ORDER_CODE_SEQ_PADDING, '0'),
    ].join('-');
  }
}
