import {
  BadRequestException,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { EntityManager } from 'typeorm';

import { AttachmentsService } from '../attachments/attachments.service';
import { AttachableType } from '../attachments/enums/attachable-type.enum';
import { transactionalDataSource } from '../database/transaction.fixture';
import { ProductImage } from './entities/product-image.entity';
import { ProductStatus } from './enums/product-status.enum';
import { ProductImagesService } from './product-images.service';
import { MAX_PRODUCT_IMAGES } from './products.constants';
import { ProductsService } from './products.service';

describe('ProductImagesService', () => {
  const PRODUCT_ID = 'product-id';
  const upload = (name: string) => ({
    originalname: name,
    buffer: Buffer.from(name),
  });

  const image = (
    id: string,
    position: number,
    isThumbnail = false,
  ): ProductImage =>
    ({
      id,
      productId: PRODUCT_ID,
      attachmentId: `attachment-${id}`,
      position,
      isThumbnail,
    }) as ProductImage;

  const repositoryInTransaction = {
    create: jest.fn((value: Partial<ProductImage>) => value),
    save: jest.fn((value: Partial<ProductImage>) => Promise.resolve(value)),
  };
  const managerMock = {
    find: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    getRepository: jest.fn(() => repositoryInTransaction),
  };
  const { dataSource } = transactionalDataSource(
    managerMock as unknown as EntityManager,
  );
  const productsMock = { lock: jest.fn(), invalidateCache: jest.fn() };
  const attachmentsMock = {
    validate: jest.fn((file: { originalname: string } | undefined) => {
      if (!file) {
        throw new BadRequestException('attachments.FILE_REQUIRED');
      }

      return file;
    }),
    attach: jest.fn((_manager: unknown, file: { originalname: string }) =>
      Promise.resolve({ id: `attachment-${file.originalname}` }),
    ),
    detach: jest.fn(),
  };
  const i18nMock = { t: jest.fn((key: string) => key) };

  let service: ProductImagesService;

  const existing = (...images: ProductImage[]) =>
    managerMock.find.mockResolvedValueOnce(images).mockResolvedValue(images);

  const saved = () =>
    (repositoryInTransaction.save.mock.calls as [Partial<ProductImage>][]).map(
      ([value]) => value,
    );

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);

    service = new ProductImagesService(
      dataSource,
      productsMock as unknown as ProductsService,
      attachmentsMock as unknown as AttachmentsService,
      i18nMock as unknown as I18nService,
    );

    productsMock.lock.mockResolvedValue({
      id: PRODUCT_ID,
      status: ProductStatus.Draft,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  describe('add', () => {
    it('makes the first image of a product its thumbnail', async () => {
      existing();

      await service.add(PRODUCT_ID, [upload('a.png'), upload('b.png')]);

      expect(saved()).toEqual([
        expect.objectContaining({ position: 0, isThumbnail: true }),
        expect.objectContaining({ position: 1, isThumbnail: false }),
      ]);
      expect(attachmentsMock.attach).toHaveBeenCalledWith(
        managerMock,
        upload('a.png'),
        { type: AttachableType.Product, id: PRODUCT_ID },
      );
      expect(productsMock.invalidateCache).toHaveBeenCalled();
    });

    it('appends after the highest position', async () => {
      existing(image('i1', 0, true), image('i2', 3));

      await service.add(PRODUCT_ID, [upload('c.png')]);

      expect(saved()).toEqual([
        expect.objectContaining({ position: 4, isThumbnail: false }),
      ]);
    });

    it('lowers the old thumbnail before raising the new one', async () => {
      existing(image('i1', 0, true));

      await service.add(PRODUCT_ID, [upload('c.png')], true);

      expect(managerMock.update).toHaveBeenCalledWith(
        ProductImage,
        { id: 'i1' },
        { isThumbnail: false },
      );
      expect(managerMock.update.mock.invocationCallOrder[0]).toBeLessThan(
        repositoryInTransaction.save.mock.invocationCallOrder[0],
      );
      expect(saved()).toEqual([expect.objectContaining({ isThumbnail: true })]);
    });

    it(`refuses to go past ${MAX_PRODUCT_IMAGES} images with 422`, async () => {
      existing(
        ...[0, 1, 2, 3].map((position) => image(`i${position}`, position)),
      );

      await expect(
        service.add(PRODUCT_ID, [upload('a.png'), upload('b.png')]),
      ).rejects.toThrow(
        new UnprocessableEntityException('products.TOO_MANY_IMAGES'),
      );
      expect(attachmentsMock.attach).not.toHaveBeenCalled();
    });

    it('validates every file before opening the transaction', async () => {
      await expect(service.add(PRODUCT_ID, [])).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(productsMock.lock).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('deletes the row before its attachment', async () => {
      existing(image('i1', 0, true), image('i2', 1));

      await service.remove(PRODUCT_ID, 'i2');

      expect(managerMock.delete).toHaveBeenCalledWith(ProductImage, {
        id: 'i2',
      });
      expect(attachmentsMock.detach).toHaveBeenCalledWith(
        managerMock,
        'attachment-i2',
      );
      expect(managerMock.update).not.toHaveBeenCalled();
      expect(productsMock.invalidateCache).toHaveBeenCalled();
    });

    it('promotes the next image by position when the thumbnail goes', async () => {
      existing(image('i1', 0, true), image('i2', 2), image('i3', 5));

      await service.remove(PRODUCT_ID, 'i1');

      expect(managerMock.update).toHaveBeenCalledWith(
        ProductImage,
        { id: 'i2' },
        { isThumbnail: true },
      );
    });

    it('answers 404 for an image of another product', async () => {
      existing(image('i1', 0, true));

      await expect(service.remove(PRODUCT_ID, 'other')).rejects.toThrow(
        new NotFoundException('products.IMAGE_NOT_FOUND'),
      );
    });

    it('refuses to remove the last image of a published product', async () => {
      productsMock.lock.mockResolvedValue({
        id: PRODUCT_ID,
        status: ProductStatus.Published,
      });
      existing(image('i1', 0, true));

      await expect(service.remove(PRODUCT_ID, 'i1')).rejects.toThrow(
        new UnprocessableEntityException('products.LAST_IMAGE'),
      );
      expect(managerMock.delete).not.toHaveBeenCalled();
    });

    it('lets a draft lose its last image', async () => {
      existing(image('i1', 0, true));

      await service.remove(PRODUCT_ID, 'i1');

      expect(attachmentsMock.detach).toHaveBeenCalled();
    });
  });
});
