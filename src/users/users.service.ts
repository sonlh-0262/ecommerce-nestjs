import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';

import { User } from './entities/user.entity';
import { CreateUserInput } from './interfaces/create-user-input.interface';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
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

  async create(input: CreateUserInput): Promise<User> {
    const user = await this.usersRepository.save(
      this.usersRepository.create({
        ...input,
        email: UsersService.normaliseEmail(input.email),
      }),
    );

    this.logger.log(`Created user ${user.username} (${user.id})`);

    return user;
  }

  private queryByEmail(email: string): SelectQueryBuilder<User> {
    return this.usersRepository
      .createQueryBuilder('user')
      .where('lower(user.email) = :email', {
        email: UsersService.normaliseEmail(email),
      });
  }
}
