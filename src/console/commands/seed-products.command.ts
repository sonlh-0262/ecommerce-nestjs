import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFile } from 'fs/promises';
import { Command, CommandRunner } from 'nest-commander';
import * as path from 'path';

import { UploadedImage } from '../../attachments/interfaces/uploaded-image.interface';
import { SLUG_MAX_LENGTH as CATEGORY_SLUG_MAX_LENGTH } from '../../categories/categories.constants';
import { CategoriesService } from '../../categories/categories.service';
import { generateSlug } from '../../common/helpers/slug';
import { Environment } from '../../config/env.validation';
import {
  SEED_PRODUCTS,
  seedProductAttributes,
} from '../../database/seeds/products.seed-data';
import {
  SEED_IMAGE_FILES,
  SEED_IMAGES_DIRECTORY,
} from '../../database/seeds/seed.constants';
import { ProductStatus } from '../../products/enums/product-status.enum';
import { ProductImagesService } from '../../products/product-images.service';
import { SLUG_MAX_LENGTH } from '../../products/products.constants';
import { ProductsService } from '../../products/products.service';
import { SEED_COMMANDS } from '../console.constants';
import { isProduction } from '../production-guard';

@Command({
  name: SEED_COMMANDS.products,
  description:
    'Create the sample products with placeholder images, skipping existing slugs.',
})
export class SeedProductsCommand extends CommandRunner {
  private readonly logger = new Logger(SeedProductsCommand.name);

  constructor(
    private readonly productsService: ProductsService,
    private readonly productImages: ProductImagesService,
    private readonly categoriesService: CategoriesService,
    private readonly configService: ConfigService,
  ) {
    super();
  }

  async run(): Promise<void> {
    if (isProduction(this.configService)) {
      throw new Error(
        `Refusing to seed sample products with NODE_ENV=${Environment.Production}.`,
      );
    }

    const images = await this.loadImages();
    let created = 0;

    for (const [index, seed] of SEED_PRODUCTS.entries()) {
      if (
        await this.productsService.findBySlug(
          generateSlug(seed.name, SLUG_MAX_LENGTH),
        )
      ) {
        continue;
      }

      const category = await this.categoriesService.findBySlug(
        generateSlug(seed.category, CATEGORY_SLUG_MAX_LENGTH),
      );

      if (!category) {
        throw new Error(
          `Category "${seed.category}" is missing: run ` +
            `${SEED_COMMANDS.categories} first.`,
        );
      }

      const { imageCount, published, ...attributes } =
        seedProductAttributes(index);
      const product = await this.productsService.create({
        ...attributes,
        name: seed.name,
        description: seed.description,
        categoryId: category.id,
      });

      await this.productImages.add(product.id, images.slice(0, imageCount));

      if (published) {
        await this.productsService.update(product.id, {
          status: ProductStatus.Published,
        });
      }

      created += 1;
    }

    this.logger.log(`Created ${created} products`);
  }

  private loadImages(): Promise<UploadedImage[]> {
    return Promise.all(
      SEED_IMAGE_FILES.map(async (originalname) => ({
        originalname,
        buffer: await readFile(path.join(SEED_IMAGES_DIRECTORY, originalname)),
      })),
    );
  }
}
