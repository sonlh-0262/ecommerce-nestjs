import {
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { DataSource, EntityManager } from 'typeorm';

import { AttachmentsService } from '../attachments/attachments.service';
import { AttachableType } from '../attachments/enums/attachable-type.enum';
import { UploadedImage } from '../attachments/interfaces/uploaded-image.interface';
import { ProductImage } from './entities/product-image.entity';
import { ProductStatus } from './enums/product-status.enum';
import { MAX_PRODUCT_IMAGES } from './products.constants';
import { ProductsService } from './products.service';

@Injectable()
export class ProductImagesService {
  private readonly logger = new Logger(ProductImagesService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly productsService: ProductsService,
    private readonly attachments: AttachmentsService,
    private readonly i18n: I18nService,
  ) {}

  async add(
    productId: string,
    uploads: UploadedImage[] | undefined,
    makeThumbnail = false,
  ): Promise<ProductImage[]> {
    const images = (uploads?.length ? uploads : [undefined]).map((upload) =>
      this.attachments.validate(upload),
    );

    const all = await this.dataSource.transaction(async (manager) => {
      await this.productsService.lock(manager, productId);

      const existing = await this.imagesOf(manager, productId);

      if (existing.length + images.length > MAX_PRODUCT_IMAGES) {
        throw new UnprocessableEntityException(
          this.i18n.t('products.TOO_MANY_IMAGES', {
            args: { limit: MAX_PRODUCT_IMAGES },
          }),
        );
      }

      const thumbnail = existing.find((image) => image.isThumbnail);

      if (makeThumbnail && thumbnail) {
        await manager.update(
          ProductImage,
          { id: thumbnail.id },
          { isThumbnail: false },
        );
      }

      const firstPosition = (existing.at(-1)?.position ?? -1) + 1;
      const repository = manager.getRepository(ProductImage);

      for (const [index, image] of images.entries()) {
        const attachment = await this.attachments.attach(manager, image, {
          type: AttachableType.Product,
          id: productId,
        });

        await repository.save(
          repository.create({
            productId,
            attachmentId: attachment.id,
            isThumbnail: index === 0 && (makeThumbnail || !thumbnail),
            position: firstPosition + index,
          }),
        );
      }

      return this.imagesOf(manager, productId);
    });

    await this.productsService.invalidateCache();
    this.logger.log(`Added ${images.length} image(s) to product ${productId}`);

    return all;
  }

  async remove(productId: string, imageId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const product = await this.productsService.lock(manager, productId);
      const images = await this.imagesOf(manager, productId);
      const image = images.find(({ id }) => id === imageId);

      if (!image) {
        throw new NotFoundException(this.i18n.t('products.IMAGE_NOT_FOUND'));
      }

      if (images.length === 1 && product.status === ProductStatus.Published) {
        throw new UnprocessableEntityException(
          this.i18n.t('products.LAST_IMAGE'),
        );
      }

      await manager.delete(ProductImage, { id: image.id });
      await this.attachments.detach(manager, image.attachmentId);

      const successor = images.find(({ id }) => id !== image.id);

      if (image.isThumbnail && successor) {
        await manager.update(
          ProductImage,
          { id: successor.id },
          { isThumbnail: true },
        );
      }
    });

    await this.productsService.invalidateCache();
    this.logger.log(`Removed image ${imageId} from product ${productId}`);
  }

  private imagesOf(
    manager: EntityManager,
    productId: string,
  ): Promise<ProductImage[]> {
    return manager.find(ProductImage, {
      where: { productId },
      relations: { attachment: true },
      order: { position: 'ASC' },
    });
  }
}
