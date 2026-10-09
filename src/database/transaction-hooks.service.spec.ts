import { Logger } from '@nestjs/common';
import {
  DataSource,
  EntityManager,
  QueryRunner,
  TransactionCommitEvent,
  TransactionRollbackEvent,
  TransactionStartEvent,
} from 'typeorm';

import { TransactionHooks } from './transaction-hooks.service';

class FakeTransaction {
  readonly queryRunner = {
    isTransactionActive: false,
  } as QueryRunner;
  readonly manager = { queryRunner: this.queryRunner } as EntityManager;
  private depth = 0;

  constructor(private readonly hooks: TransactionHooks) {}

  begin(): this {
    this.depth += 1;
    this.setActive(true);
    this.hooks.afterTransactionStart({
      queryRunner: this.queryRunner,
    } as TransactionStartEvent);

    return this;
  }

  commit(): Promise<void> {
    this.close();

    return this.hooks.afterTransactionCommit({
      queryRunner: this.queryRunner,
    } as TransactionCommitEvent);
  }

  rollback(): Promise<void> {
    this.close();

    return this.hooks.afterTransactionRollback({
      queryRunner: this.queryRunner,
    } as TransactionRollbackEvent);
  }

  private close(): void {
    this.depth -= 1;
    this.setActive(this.depth > 0);
  }

  private setActive(active: boolean): void {
    (this.queryRunner as { isTransactionActive: boolean }).isTransactionActive =
      active;
  }
}

describe('TransactionHooks', () => {
  let dataSource: { subscribers: unknown[] };
  let hooks: TransactionHooks;
  let logError: jest.SpyInstance;

  const task = () => jest.fn().mockResolvedValue(undefined);
  const open = () => new FakeTransaction(hooks).begin();

  beforeEach(() => {
    dataSource = { subscribers: [] };
    hooks = new TransactionHooks(dataSource as unknown as DataSource);
    logError = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('subscribes itself to the data source exactly once', () => {
    expect(dataSource.subscribers).toEqual([hooks]);
  });

  describe('afterCommit', () => {
    it('waits for the commit before running the task', async () => {
      const transaction = open();
      const cleanup = task();

      await hooks.afterCommit(transaction.manager, cleanup);
      expect(cleanup).not.toHaveBeenCalled();

      await transaction.commit();
      expect(cleanup).toHaveBeenCalledTimes(1);
    });

    it('drops the task when the transaction rolls back', async () => {
      const transaction = open();
      const cleanup = task();

      await hooks.afterCommit(transaction.manager, cleanup);
      await transaction.rollback();

      expect(cleanup).not.toHaveBeenCalled();
    });

    it('runs the task at once outside a transaction', async () => {
      const cleanup = task();

      await hooks.afterCommit({} as EntityManager, cleanup);

      expect(cleanup).toHaveBeenCalledTimes(1);
    });

    it('runs tasks in the order they were registered', async () => {
      const transaction = open();
      const order: string[] = [];

      await hooks.afterCommit(transaction.manager, () => {
        order.push('first');

        return Promise.resolve();
      });
      await hooks.afterCommit(transaction.manager, () => {
        order.push('second');

        return Promise.resolve();
      });
      await transaction.commit();

      expect(order).toEqual(['first', 'second']);
    });

    it('keeps going and logs when a task fails', async () => {
      const transaction = open();
      const after = task();

      await hooks.afterCommit(transaction.manager, () =>
        Promise.reject(new Error('disk full')),
      );
      await hooks.afterCommit(transaction.manager, after);

      await expect(transaction.commit()).resolves.toBeUndefined();
      expect(after).toHaveBeenCalled();
      expect(logError).toHaveBeenCalled();
    });

    it('does not carry tasks over to the next transaction on the runner', async () => {
      const transaction = open();
      const cleanup = task();

      await hooks.afterCommit(transaction.manager, cleanup);
      await transaction.commit();

      transaction.begin();
      await transaction.commit();

      expect(cleanup).toHaveBeenCalledTimes(1);
    });
  });

  describe('afterRollback', () => {
    it('runs the task when the transaction rolls back', async () => {
      const transaction = open();
      const cleanup = task();

      hooks.afterRollback(transaction.manager, cleanup);
      await transaction.rollback();

      expect(cleanup).toHaveBeenCalledTimes(1);
    });

    it('drops the task when the transaction commits', async () => {
      const transaction = open();
      const cleanup = task();

      hooks.afterRollback(transaction.manager, cleanup);
      await transaction.commit();

      expect(cleanup).not.toHaveBeenCalled();
    });

    it('ignores the task outside a transaction: nothing can roll back', () => {
      const cleanup = jest.fn();

      hooks.afterRollback({} as EntityManager, cleanup);

      expect(cleanup).not.toHaveBeenCalled();
    });
  });

  describe('savepoints', () => {
    it('defers a released savepoint to the outer commit', async () => {
      const transaction = open();
      const cleanup = task();

      transaction.begin();
      await hooks.afterCommit(transaction.manager, cleanup);
      await transaction.commit();

      expect(cleanup).not.toHaveBeenCalled();

      await transaction.commit();
      expect(cleanup).toHaveBeenCalledTimes(1);
    });

    it('drops the commit tasks of a savepoint that rolled back', async () => {
      const transaction = open();
      const deleteFile = task();

      transaction.begin();
      await hooks.afterCommit(transaction.manager, deleteFile);
      await transaction.rollback();
      await transaction.commit();

      expect(deleteFile).not.toHaveBeenCalled();
    });

    it('runs the rollback tasks of a savepoint as soon as it rolls back', async () => {
      const transaction = open();
      const removeOrphan = task();

      transaction.begin();
      hooks.afterRollback(transaction.manager, removeOrphan);
      await transaction.rollback();

      expect(removeOrphan).toHaveBeenCalledTimes(1);

      await transaction.commit();
      expect(removeOrphan).toHaveBeenCalledTimes(1);
    });

    it('keeps the outer tasks when only a savepoint rolls back', async () => {
      const transaction = open();
      const outer = task();

      await hooks.afterCommit(transaction.manager, outer);
      transaction.begin();
      await transaction.rollback();
      await transaction.commit();

      expect(outer).toHaveBeenCalledTimes(1);
    });

    it('rolls back a released savepoint with the outer transaction', async () => {
      const transaction = open();
      const deleteFile = task();
      const removeOrphan = task();

      transaction.begin();
      await hooks.afterCommit(transaction.manager, deleteFile);
      hooks.afterRollback(transaction.manager, removeOrphan);
      await transaction.commit();
      await transaction.rollback();

      expect(deleteFile).not.toHaveBeenCalled();
      expect(removeOrphan).toHaveBeenCalledTimes(1);
    });
  });
});
