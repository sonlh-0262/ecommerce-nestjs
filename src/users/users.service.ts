import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { I18nService } from 'nestjs-i18n';
import { EntityManager, Repository, SelectQueryBuilder } from 'typeorm';

import { uniqueViolationConstraint } from '../database/unique-violation';
import {
  UNIQUE_USERS_EMAIL_INDEX,
  UNIQUE_USERS_USERNAME_INDEX,
} from './entities/user.entity.constants';
import { User } from './entities/user.entity';
import { CreateUserInput } from './interfaces/create-user-input.interface';
import { UserPatch } from './interfaces/user-patch.interface';
import { USER_UNIQUE_CONFLICTS } from './users.constants';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly i18n: I18nService,
  ) {}

  /**
   * `UQ_users_email` indexes `lower(email)`, so every lookup has to compare
   * the same expression or PostgreSQL falls back to a sequential scan.
   */
  static normaliseEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  /** Soft-deleted rows are excluded by TypeORM, since `User` has a delete date. */
  findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.queryByEmail(email).getOne();
  }

  /**
   * The only read that pulls `passwordHash`, which the column declares as
   * `select: false` precisely so it cannot leak into an unrelated query.
   */
  findByEmailWithPassword(email: string): Promise<User | null> {
    return this.queryByEmail(email).addSelect('user.passwordHash').getOne();
  }

  async assertAvailable(email: string, username: string): Promise<void> {
    if (await this.queryByEmail(email).getExists()) {
      throw this.conflict(UNIQUE_USERS_EMAIL_INDEX);
    }

    if (await this.usersRepository.existsBy({ username })) {
      throw this.conflict(UNIQUE_USERS_USERNAME_INDEX);
    }
  }

  async create(
    input: CreateUserInput,
    manager: EntityManager = this.usersRepository.manager,
  ): Promise<User> {
    const repository = manager.getRepository(User);
    let user: User;

    try {
      user = await repository.save(
        repository.create({
          ...input,
          email: UsersService.normaliseEmail(input.email),
        }),
      );
    } catch (error) {
      const constraint = uniqueViolationConstraint(error);

      throw constraint && USER_UNIQUE_CONFLICTS[constraint]
        ? this.conflict(constraint)
        : error;
    }

    this.logger.log(`Created user ${user.username} (${user.id})`);

    return user;
  }

  async update(
    user: User,
    patch: UserPatch,
    manager: EntityManager = this.usersRepository.manager,
  ): Promise<User> {
    if (Object.keys(patch).length === 0) {
      return user;
    }

    await manager.update(User, { id: user.id }, patch);

    return Object.assign(user, patch);
  }

  private conflict(constraint: string): ConflictException {
    return new ConflictException(
      this.i18n.t(USER_UNIQUE_CONFLICTS[constraint]),
    );
  }

  private queryByEmail(email: string): SelectQueryBuilder<User> {
    return this.usersRepository
      .createQueryBuilder('user')
      .where('lower(user.email) = :email', {
        email: UsersService.normaliseEmail(email),
      });
  }
}
