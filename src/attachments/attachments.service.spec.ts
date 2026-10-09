import {
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { StreamableHandlerResponse } from '@nestjs/common/file-stream/interfaces';
import { ConfigService } from '@nestjs/config';
import { I18nService } from 'nestjs-i18n';
import { Readable } from 'stream';
import { EntityManager, In, Repository } from 'typeorm';

import { AppConfig } from '../config/configuration';
import { TransactionHooks } from '../database/transaction-hooks.service';
import { AttachmentsService } from './attachments.service';
import { Attachment } from './entities/attachment.entity';
import { AttachableType } from './enums/attachable-type.enum';
import { contentDisposition } from './storage/file-name';
import { LocalStorageService } from './storage/local-storage.service';
import { ImageFileValidator } from './validators/file.validator';

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(16, 0x00),
]);

const UUID_PATH = /^\d{4}\/\d{2}\/[0-9a-f-]{36}\.png$/;

const buildAttachment = (overrides: Partial<Attachment> = {}): Attachment => ({
  id: 'attachment-id',
  attachableType: AttachableType.Product,
  attachableId: 'owner-id',
  url: '/api/v1/attachments/attachment-id',
  fileName: 'photo.png',
  fileType: 'image/png',
  fileSize: PNG.length,
  storagePath: '2026/10/attachment-id.png',
  createdAt: new Date('2026-10-05T00:00:00.000Z'),
  updatedAt: new Date('2026-10-05T00:00:00.000Z'),
  ...overrides,
});

describe('AttachmentsService', () => {
  let service: AttachmentsService;
  let logError: jest.SpyInstance;

  const repositoryMock = {
    find: jest.fn(),
    findOne: jest.fn(),
    delete: jest.fn(),
    create: jest.fn((row: Partial<Attachment>) => row as Attachment),
    save: jest.fn((row: Attachment) => Promise.resolve(row)),
    get manager() {
      return manager;
    },
  };
  const getRepository = jest.fn(() => repositoryMock);
  const manager = { getRepository } as unknown as EntityManager;

  const storageMock = {
    save: jest.fn(),
    remove: jest.fn(),
    openReadStream: jest.fn(),
  };
  const hooksMock = { afterCommit: jest.fn(), afterRollback: jest.fn() };
  const i18nMock = { t: jest.fn((key: string) => key) };
  const appConfig = { apiPrefix: 'api/v1' } as AppConfig;

  const owner = { type: AttachableType.Product, id: 'owner-id' };

  const runRegistered = async (hook: jest.Mock) => {
    const [, task] = hook.mock.calls[0] as [unknown, () => Promise<void>];

    await task();
  };

  beforeEach(() => {
    service = new AttachmentsService(
      repositoryMock as unknown as Repository<Attachment>,
      storageMock as unknown as LocalStorageService,
      new ImageFileValidator(i18nMock as unknown as I18nService),
      hooksMock as unknown as TransactionHooks,
      i18nMock as unknown as I18nService,
      { getOrThrow: () => appConfig } as unknown as ConfigService,
    );

    storageMock.openReadStream.mockImplementation(() =>
      Promise.resolve(Readable.from(PNG)),
    );
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    logError = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  const image = (originalname: string) =>
    service.validate({ originalname, buffer: PNG });

  describe('validate', () => {
    it('describes an accepted image', () => {
      expect(image('photo.png').type).toEqual({
        mime: 'image/png',
        extension: 'png',
      });
    });

    it('rejects a file that is not an accepted image with 422', () => {
      expect(() =>
        service.validate({
          originalname: 'notes.png',
          buffer: Buffer.from('plain text'),
        }),
      ).toThrow(UnprocessableEntityException);
    });
  });

  describe('attach', () => {
    it('stores the file and returns the row describing it', async () => {
      const attachment = await service.attach(
        manager,
        image('photo.png'),
        owner,
      );

      expect(attachment).toMatchObject({
        attachableType: AttachableType.Product,
        attachableId: 'owner-id',
        fileName: 'photo.png',
        fileType: 'image/png',
        fileSize: PNG.length,
        url: `/api/v1/attachments/${attachment.id}`,
      });
    });

    it('writes through the caller transaction', async () => {
      await service.attach(manager, image('photo.png'), owner);

      expect(getRepository).toHaveBeenCalledWith(Attachment);
    });

    it('names the file on disk after a fresh uuid, bucketed by month', async () => {
      const attachment = await service.attach(
        manager,
        image('../../etc/passwd'),
        owner,
      );

      expect(attachment.storagePath).toMatch(UUID_PATH);
      expect(attachment.storagePath).toContain(attachment.id);
      expect(storageMock.save).toHaveBeenCalledWith(
        attachment.storagePath,
        PNG,
      );
    });

    it('trusts the bytes over the claimed extension', async () => {
      const attachment = await service.attach(
        manager,
        image('photo.gif'),
        owner,
      );

      expect(attachment.fileType).toBe('image/png');
      expect(attachment.fileName).toBe('photo.gif.png');
    });

    it('removes a partly written file when the write fails', async () => {
      storageMock.save.mockRejectedValueOnce(new Error('ENOSPC'));

      await expect(
        service.attach(manager, image('photo.png'), owner),
      ).rejects.toThrow('ENOSPC');

      const [storagePath] = storageMock.save.mock.calls[0] as [string];

      expect(storageMock.remove).toHaveBeenCalledWith(storagePath);
      expect(repositoryMock.save).not.toHaveBeenCalled();
    });

    it('removes the file again when the row cannot be inserted', async () => {
      repositoryMock.save.mockRejectedValueOnce(new Error('23505'));

      await expect(
        service.attach(manager, image('photo.png'), owner),
      ).rejects.toThrow('23505');

      const [storagePath] = storageMock.save.mock.calls[0] as [string];

      expect(storageMock.remove).toHaveBeenCalledWith(storagePath);
    });

    it('removes the file if the caller transaction later rolls back', async () => {
      const attachment = await service.attach(
        manager,
        image('photo.png'),
        owner,
      );

      expect(storageMock.remove).not.toHaveBeenCalled();

      await runRegistered(hooksMock.afterRollback);

      expect(storageMock.remove).toHaveBeenCalledWith(attachment.storagePath);
    });
  });

  describe('detach', () => {
    it('deletes the row straight away', async () => {
      repositoryMock.findOne.mockResolvedValue(buildAttachment());

      await service.detach(manager, 'attachment-id');

      expect(repositoryMock.delete).toHaveBeenCalledWith({
        id: 'attachment-id',
      });
    });

    it('leaves the file until the transaction commits', async () => {
      repositoryMock.findOne.mockResolvedValue(buildAttachment());

      await service.detach(manager, 'attachment-id');

      expect(storageMock.remove).not.toHaveBeenCalled();

      await runRegistered(hooksMock.afterCommit);

      expect(storageMock.remove).toHaveBeenCalledWith(
        '2026/10/attachment-id.png',
      );
    });

    it('answers an unknown id with 404', async () => {
      repositoryMock.findOne.mockResolvedValue(null);

      await expect(service.detach(manager, 'missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(repositoryMock.delete).not.toHaveBeenCalled();
    });
  });

  describe('findForOwner', () => {
    it('reads through the manager it is given', async () => {
      repositoryMock.find.mockResolvedValue([]);

      await service.findForOwner(AttachableType.User, ['u1'], manager);

      expect(getRepository).toHaveBeenCalledWith(Attachment);
    });

    it('loads every owner in one query and groups the rows', async () => {
      repositoryMock.find.mockResolvedValue([
        buildAttachment({ id: 'a', attachableId: 'p1' }),
        buildAttachment({ id: 'b', attachableId: 'p2' }),
        buildAttachment({ id: 'c', attachableId: 'p1' }),
      ]);

      const result = await service.findForOwner(AttachableType.Product, [
        'p1',
        'p2',
        'p3',
      ]);

      expect(repositoryMock.find).toHaveBeenCalledTimes(1);
      expect(result.get('p1')?.map(({ id }) => id)).toEqual(['a', 'c']);
      expect(result.get('p2')?.map(({ id }) => id)).toEqual(['b']);
      expect(result.has('p3')).toBe(false);
    });

    it('asks for each owner once', async () => {
      repositoryMock.find.mockResolvedValue([]);

      await service.findForOwner(AttachableType.Product, ['p1', 'p1']);

      expect(repositoryMock.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            attachableType: AttachableType.Product,
            attachableId: In(['p1']),
          },
        }),
      );
    });

    it('skips the query when there are no owners', async () => {
      await expect(
        service.findForOwner(AttachableType.Product, []),
      ).resolves.toEqual(new Map());

      expect(repositoryMock.find).not.toHaveBeenCalled();
    });
  });

  describe('download', () => {
    it('streams the stored file with the headers it belongs to', async () => {
      repositoryMock.findOne.mockResolvedValue(buildAttachment());

      const file = await service.download('attachment-id');

      expect(file.getStream()).toBeInstanceOf(Readable);
      expect(file.getHeaders()).toEqual({
        type: 'image/png',
        length: PNG.length,
        disposition: contentDisposition('photo.png'),
      });
      expect(storageMock.openReadStream).toHaveBeenCalledWith(
        '2026/10/attachment-id.png',
      );
    });

    it('ends the response and logs when the stream fails midway', async () => {
      repositoryMock.findOne.mockResolvedValue(buildAttachment());
      const response = { end: jest.fn() };

      const file = await service.download('attachment-id');
      file.errorHandler(
        new Error('disk died'),
        response as unknown as StreamableHandlerResponse,
      );

      expect(response.end).toHaveBeenCalled();
      expect(logError).toHaveBeenCalledWith(
        expect.stringContaining('disk died'),
      );
    });

    it('answers an unknown id with 404', async () => {
      repositoryMock.findOne.mockResolvedValue(null);

      await expect(service.download('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('answers with 404 when the row outlived its file', async () => {
      repositoryMock.findOne.mockResolvedValue(buildAttachment());
      storageMock.openReadStream.mockResolvedValue(null);

      await expect(service.download('attachment-id')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  it('builds the url without a prefix when the API has none', async () => {
    const unprefixed = new AttachmentsService(
      repositoryMock as unknown as Repository<Attachment>,
      storageMock as unknown as LocalStorageService,
      new ImageFileValidator(i18nMock as unknown as I18nService),
      hooksMock as unknown as TransactionHooks,
      i18nMock as unknown as I18nService,
      {
        getOrThrow: () => ({ ...appConfig, apiPrefix: '' }),
      } as unknown as ConfigService,
    );

    const attachment = await unprefixed.attach(
      manager,
      image('photo.png'),
      owner,
    );

    expect(attachment.url).toBe(`/attachments/${attachment.id}`);
  });
});
