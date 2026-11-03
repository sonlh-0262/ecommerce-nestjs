import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { I18nService } from 'nestjs-i18n';
import { Repository } from 'typeorm';

import { APP_CONFIG_KEY, AppConfig } from '../config/configuration';
import { Product } from './entities/product.entity';
import { ProductStatus } from './enums/product-status.enum';
import {
  ProductShare,
  ShareOrigins,
} from './interfaces/product-share.interface';
import { shareOf } from './product-share';
import { ProductThumbnailsService } from './product-thumbnails.service';

@Injectable()
export class ProductShareService {
  private readonly origins: ShareOrigins;

  constructor(
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
    private readonly thumbnails: ProductThumbnailsService,
    private readonly i18n: I18nService,
    configService: ConfigService,
  ) {
    const { webUrl, apiUrl } =
      configService.getOrThrow<AppConfig>(APP_CONFIG_KEY);

    this.origins = { webUrl, apiUrl };
  }

  async share(slug: string): Promise<ProductShare> {
    const product = await this.productsRepository.findOneBy({
      slug,
      status: ProductStatus.Published,
    });

    if (!product) {
      throw new NotFoundException(this.i18n.t('products.NOT_FOUND'));
    }

    const thumbnails = await this.thumbnails.urlsOf([product.id]);

    return shareOf(product, thumbnails.get(product.id) ?? null, this.origins);
  }
}
