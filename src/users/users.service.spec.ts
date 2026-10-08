import { ConflictException, Logger } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { EntityManager, QueryFailedError, Repository } from 'typeorm';

import {
  PG_FOREIGN_KEY_VIOLATION,
  PG_UNIQUE_VIOLATION,
} from '../database/database.constants';
import {
  UNIQUE_USERS_EMAIL_INDEX,
  UNIQUE_USERS_USERNAME_INDEX,
} from './entities/user.entity.constants';
import { buildUser } from './entities/user.fixture';
import { User } from './entities/user.entity';
import { UserStatus } from './enums/user-status.enum';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;

  const queryBuilder = {
    where: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    getExists: jest.fn(),
    getOne: jest.fn(),
  };
  const scopedRepository = {
    create: jest.fn((input: Partial<User>) => input),
    save: jest.fn(),
  };
  const defaultManager = {
    getRepository: jest.fn(() => scopedRepository),
    update: jest.fn(),
  };
  const repositoryMock = {
    manager: defaultManager,
    createQueryBuilder: jest.fn(() => queryBuilder),
    existsBy: jest.fn(),
  };
  const i18nMock = { t: jest.fn((key: string) => key) };

  const uniqueViolation = (constraint: string) =>
    new QueryFailedError('INSERT ...', [], {
      code: PG_UNIQUE_VIOLATION,
      constraint,
    } as unknown as Error);

  beforeEach(() => {
    service = new UsersService(
      repositoryMock as unknown as Repository<User>,
      i18nMock as unknown as I18nService,
    );
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  describe('assertAvailable', () => {
    it('resolves when neither the email nor the username is taken', async () => {
      queryBuilder.getExists.mockResolvedValue(false);
      repositoryMock.existsBy.mockResolvedValue(false);

      await expect(
        service.assertAvailable('Son@Example.com', 'sonlh'),
      ).resolves.toBeUndefined();
      expect(queryBuilder.where).toHaveBeenCalledWith(
        'lower(user.email) = :email',
        { email: 'son@example.com' },
      );
    });

    it('rejects a taken email with 409', async () => {
      queryBuilder.getExists.mockResolvedValue(true);

      await expect(
        service.assertAvailable('son@example.com', 'x'),
      ).rejects.toThrow(new ConflictException('users.EMAIL_TAKEN'));
      expect(repositoryMock.existsBy).not.toHaveBeenCalled();
    });

    it('rejects a taken username with 409', async () => {
      queryBuilder.getExists.mockResolvedValue(false);
      repositoryMock.existsBy.mockResolvedValue(true);

      await expect(
        service.assertAvailable('a@example.com', 'sonlh'),
      ).rejects.toThrow(new ConflictException('users.USERNAME_TAKEN'));
    });
  });

  describe('findByIdWithPassword', () => {
    it('selects the hash the column hides by default', async () => {
      const user = buildUser();
      queryBuilder.getOne.mockResolvedValue(user);

      await expect(service.findByIdWithPassword(user.id)).resolves.toBe(user);
      expect(queryBuilder.addSelect).toHaveBeenCalledWith('user.passwordHash');
      expect(queryBuilder.where).toHaveBeenCalledWith('user.id = :id', {
        id: user.id,
      });
    });
  });

  describe('assertUsernameAvailable', () => {
    it('resolves for a free username', async () => {
      repositoryMock.existsBy.mockResolvedValue(false);

      await expect(
        service.assertUsernameAvailable('fresh'),
      ).resolves.toBeUndefined();
      expect(repositoryMock.existsBy).toHaveBeenCalledWith({
        username: 'fresh',
      });
    });

    it('rejects a taken username with 409', async () => {
      repositoryMock.existsBy.mockResolvedValue(true);

      await expect(service.assertUsernameAvailable('sonlh')).rejects.toThrow(
        new ConflictException('users.USERNAME_TAKEN'),
      );
    });
  });

  describe('create', () => {
    const input = {
      email: ' Son@Example.com ',
      username: 'sonlh',
      passwordHash: 'hash',
    };

    it('saves through the manager it is given', async () => {
      const getRepository = jest.fn(() => scopedRepository);
      const manager = { getRepository } as unknown as EntityManager;
      scopedRepository.save.mockResolvedValue(buildUser());

      await service.create(input, manager);

      expect(getRepository).toHaveBeenCalledWith(User);
      expect(scopedRepository.create).toHaveBeenCalledWith({
        ...input,
        email: 'son@example.com',
      });
    });

    it.each([
      [UNIQUE_USERS_EMAIL_INDEX, 'users.EMAIL_TAKEN'],
      [UNIQUE_USERS_USERNAME_INDEX, 'users.USERNAME_TAKEN'],
    ])('turns a race lost on %s into 409', async (constraint, message) => {
      scopedRepository.save.mockRejectedValue(uniqueViolation(constraint));

      await expect(service.create(input)).rejects.toThrow(
        new ConflictException(message),
      );
    });

    it('rethrows a unique violation on another index', async () => {
      const error = uniqueViolation('UQ_something_else');
      scopedRepository.save.mockRejectedValue(error);

      await expect(service.create(input)).rejects.toBe(error);
    });

    it('rethrows any other database error', async () => {
      const error = new QueryFailedError('INSERT ...', [], {
        code: PG_FOREIGN_KEY_VIOLATION,
      } as unknown as Error);
      scopedRepository.save.mockRejectedValue(error);

      await expect(service.create(input)).rejects.toBe(error);
    });
  });

  describe('update', () => {
    it('writes the patch and returns the updated account', async () => {
      const user = buildUser({ status: UserStatus.Pending });

      const updated = await service.update(user, { status: UserStatus.Active });

      expect(defaultManager.update).toHaveBeenCalledWith(
        User,
        { id: user.id },
        { status: UserStatus.Active },
      );
      expect(updated.status).toBe(UserStatus.Active);
    });

    it('turns a username race lost on update into 409', async () => {
      defaultManager.update.mockRejectedValueOnce(
        uniqueViolation(UNIQUE_USERS_USERNAME_INDEX),
      );

      await expect(
        service.update(buildUser(), { username: 'taken' }),
      ).rejects.toThrow(new ConflictException('users.USERNAME_TAKEN'));
    });

    it('rethrows any other failure of the update', async () => {
      const error = new Error('connection lost');
      defaultManager.update.mockRejectedValueOnce(error);

      await expect(service.update(buildUser(), { fullName: 'x' })).rejects.toBe(
        error,
      );
    });

    it('skips the query for an empty patch', async () => {
      const user = buildUser();

      await expect(service.update(user, {})).resolves.toBe(user);
      expect(defaultManager.update).not.toHaveBeenCalled();
    });
  });
});
