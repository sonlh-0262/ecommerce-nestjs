import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { ProductImage } from './entities/product-image.entity';

@Injectable()
export class ProductThumbnailsService {
  constructor(
    @InjectRepository(ProductImage)
    private readonly imagesRepository: Repository<ProductImage>,
  ) {}

  async urlsOf(productIds: string[]): Promise<Map<string, string>> {
    if (productIds.length === 0) {
      return new Map();
    }

    const thumbnails = await this.imagesRepository.find({
      where: { productId: In([...new Set(productIds)]), isThumbnail: true },
      relations: { attachment: true },
    });

    return new Map(
      thumbnails.map((image) => [image.productId, image.attachment.url]),
    );
  }
}
