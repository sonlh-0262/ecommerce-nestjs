import {
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { EntityManager } from 'typeorm';

import { AttachmentsService } from '../attachments/attachments.service';
import { Attachment } from '../attachments/entities/attachment.entity';
import { AttachableType } from '../attachments/enums/attachable-type.enum';
import { transactionalDataSource } from '../database/transaction.fixture';
import { buildUser } from './entities/user.fixture';
import { User } from './entities/user.entity';
import { UserAvatarsService } from './user-avatars.service';

describe('UserAvatarsService', () => {
  const user = buildUser();
  const upload = { originalname: 'me.png', buffer: Buffer.from('png') };

  const avatar = (id: string, attachableId = user.id) =>
    ({ id, attachableId, url: `/api/v1/attachments/${id}` }) as Attachment;

  let service: UserAvatarsService;

  const managerMock = { findOne: jest.fn() };
  const { dataSource } = transactionalDataSource(
    managerMock as unknown as EntityManager,
  );
  const validated = {
    ...upload,
    type: { mime: 'image/png', extension: 'png' },
  };
  const i18nMock = { t: jest.fn((key: string) => key) };
  const attachmentsMock = {
    validate: jest.fn(),
    findForOwner: jest.fn(),
    attach: jest.fn(),
    detach: jest.fn(),
  };

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);

    service = new UserAvatarsService(
      dataSource,
      attachmentsMock as unknown as AttachmentsService,
      i18nMock as unknown as I18nService,
    );

    attachmentsMock.validate.mockReturnValue(validated);
    managerMock.findOne.mockResolvedValue(user);
    attachmentsMock.findForOwner.mockResolvedValue(new Map());
    attachmentsMock.attach.mockResolvedValue(avatar('new'));
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  describe('urlsOf', () => {
    it('maps each account to the url of its avatar in one lookup', async () => {
      attachmentsMock.findForOwner.mockResolvedValue(
        new Map([
          ['u1', [avatar('a1', 'u1')]],
          ['u2', [avatar('a2', 'u2')]],
        ]),
      );

      const urls = await service.urlsOf(['u1', 'u2', 'u3']);

      expect(attachmentsMock.findForOwner).toHaveBeenCalledTimes(1);
      expect(attachmentsMock.findForOwner).toHaveBeenCalledWith(
        AttachableType.User,
        ['u1', 'u2', 'u3'],
      );
      expect(urls).toEqual(
        new Map([
          ['u1', '/api/v1/attachments/a1'],
          ['u2', '/api/v1/attachments/a2'],
        ]),
      );
    });
  });

  describe('urlOf', () => {
    it('is the url of the avatar', async () => {
      attachmentsMock.findForOwner.mockResolvedValue(
        new Map([[user.id, [avatar('a1')]]]),
      );

      await expect(service.urlOf(user.id)).resolves.toBe(
        '/api/v1/attachments/a1',
      );
    });

    it('is null for an account without one', async () => {
      await expect(service.urlOf(user.id)).resolves.toBeNull();
    });
  });

  describe('replace', () => {
    it('locks the account before looking at its avatar', async () => {
      await service.replace(user, upload);

      expect(managerMock.findOne).toHaveBeenCalledWith(User, {
        where: { id: user.id },
        lock: { mode: 'pessimistic_write' },
      });
      expect(managerMock.findOne.mock.invocationCallOrder[0]).toBeLessThan(
        attachmentsMock.findForOwner.mock.invocationCallOrder[0],
      );
    });

    it('reads the current avatar inside the transaction', async () => {
      await service.replace(user, upload);

      expect(attachmentsMock.findForOwner).toHaveBeenCalledWith(
        AttachableType.User,
        [user.id],
        managerMock,
      );
    });

    it('detaches the old avatar before attaching the new one', async () => {
      attachmentsMock.findForOwner.mockResolvedValue(
        new Map([[user.id, [avatar('old')]]]),
      );

      await service.replace(user, upload);

      expect(attachmentsMock.detach).toHaveBeenCalledWith(managerMock, 'old');
      expect(attachmentsMock.detach.mock.invocationCallOrder[0]).toBeLessThan(
        attachmentsMock.attach.mock.invocationCallOrder[0],
      );
    });

    it('attaches the upload to the account', async () => {
      await service.replace(user, upload);

      expect(attachmentsMock.attach).toHaveBeenCalledWith(
        managerMock,
        validated,
        {
          type: AttachableType.User,
          id: user.id,
        },
      );
    });

    it('detaches nothing for a first avatar', async () => {
      await service.replace(user, upload);

      expect(attachmentsMock.detach).not.toHaveBeenCalled();
    });

    it('returns the url of the new avatar', async () => {
      await expect(service.replace(user, upload)).resolves.toBe(
        '/api/v1/attachments/new',
      );
    });

    it('refuses an invalid upload before opening a transaction', async () => {
      attachmentsMock.validate.mockImplementation(() => {
        throw new UnprocessableEntityException('attachments.INVALID_FILE_TYPE');
      });

      await expect(service.replace(user, upload)).rejects.toThrow(
        UnprocessableEntityException,
      );
      expect(managerMock.findOne).not.toHaveBeenCalled();
      expect(attachmentsMock.detach).not.toHaveBeenCalled();
    });

    it('answers 404 for an account deleted since the token was checked', async () => {
      managerMock.findOne.mockResolvedValue(null);

      await expect(service.replace(user, upload)).rejects.toThrow(
        new NotFoundException('users.NOT_FOUND'),
      );
      expect(attachmentsMock.attach).not.toHaveBeenCalled();
    });

    it('fails the whole replacement when storing the new avatar fails', async () => {
      attachmentsMock.findForOwner.mockResolvedValue(
        new Map([[user.id, [avatar('old')]]]),
      );
      attachmentsMock.attach.mockRejectedValue(new Error('disk full'));

      await expect(service.replace(user, upload)).rejects.toThrow('disk full');
    });
  });
});
