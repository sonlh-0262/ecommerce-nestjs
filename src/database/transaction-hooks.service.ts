import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  EntitySubscriberInterface,
  QueryRunner,
  TransactionCommitEvent,
  TransactionRollbackEvent,
  TransactionStartEvent,
} from 'typeorm';

export type TransactionTask = () => Promise<void>;

interface TransactionLevel {
  onCommit: TransactionTask[];
  onRollback: TransactionTask[];
}

@Injectable()
export class TransactionHooks implements EntitySubscriberInterface {
  private readonly logger = new Logger(TransactionHooks.name);
  private readonly levels = new WeakMap<QueryRunner, TransactionLevel[]>();

  constructor(@InjectDataSource() dataSource: DataSource) {
    if (!dataSource.subscribers.includes(this)) {
      dataSource.subscribers.push(this);
    }
  }

  async afterCommit(
    manager: EntityManager,
    task: TransactionTask,
  ): Promise<void> {
    const queryRunner = activeTransaction(manager);

    if (!queryRunner) {
      await this.run([task]);

      return;
    }

    this.currentLevel(queryRunner).onCommit.push(task);
  }

  afterRollback(manager: EntityManager, task: TransactionTask): void {
    const queryRunner = activeTransaction(manager);

    if (queryRunner) {
      this.currentLevel(queryRunner).onRollback.push(task);
    }
  }

  afterTransactionStart(event: TransactionStartEvent): void {
    this.stackFor(event.queryRunner).push(emptyLevel());
  }

  async afterTransactionCommit(event: TransactionCommitEvent): Promise<void> {
    const stack = this.levels.get(event.queryRunner);
    const level = stack?.pop();

    if (!stack || !level) {
      return;
    }

    const parent = stack[stack.length - 1];

    if (parent) {
      parent.onCommit.push(...level.onCommit);
      parent.onRollback.push(...level.onRollback);

      return;
    }

    this.levels.delete(event.queryRunner);

    await this.run(level.onCommit);
  }

  async afterTransactionRollback(
    event: TransactionRollbackEvent,
  ): Promise<void> {
    const stack = this.levels.get(event.queryRunner);
    const level = stack?.pop();

    if (!stack || !level) {
      return;
    }

    if (stack.length === 0) {
      this.levels.delete(event.queryRunner);
    }

    await this.run(level.onRollback);
  }

  private async run(tasks: TransactionTask[]): Promise<void> {
    for (const task of tasks) {
      try {
        await task();
      } catch (error) {
        this.logger.error(
          `Post-transaction task failed: ${(error as Error).message}`,
          (error as Error).stack,
        );
      }
    }
  }

  private stackFor(queryRunner: QueryRunner): TransactionLevel[] {
    let stack = this.levels.get(queryRunner);

    if (!stack) {
      stack = [];
      this.levels.set(queryRunner, stack);
    }

    return stack;
  }

  private currentLevel(queryRunner: QueryRunner): TransactionLevel {
    const stack = this.stackFor(queryRunner);

    if (stack.length === 0) {
      stack.push(emptyLevel());
    }

    return stack[stack.length - 1];
  }
}

function emptyLevel(): TransactionLevel {
  return { onCommit: [], onRollback: [] };
}

function activeTransaction(manager: EntityManager): QueryRunner | undefined {
  const { queryRunner } = manager;

  return queryRunner?.isTransactionActive ? queryRunner : undefined;
}
