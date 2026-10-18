import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { I18nService } from 'nestjs-i18n';
import { Repository } from 'typeorm';

import { Product } from './entities/product.entity';
import { ProductStatus } from './enums/product-status.enum';
import { ProductShareService } from './product-share.service';
import { ProductThumbnailsService } from './product-thumbnails.service';

describe('ProductShareService', () => {
  const PRODUCT = {
    id: 'p1',
    name: 'Áo thun',
    slug: 'ao-thun',
    description: 'Vải cotton.',
  } as Product;

  const productsRepository = { findOneBy: jest.fn() };
  const thumbnailsMock = { urlsOf: jest.fn() };
  const i18nMock = { t: jest.fn((key: string) => key) };
  const configMock = {
    getOrThrow: () => ({
      webUrl: 'https://shop.example.com',
      apiUrl: 'https://api.example.com',
    }),
  };

  const service = new ProductShareService(
    productsRepository as unknown as Repository<Product>,
    thumbnailsMock as unknown as ProductThumbnailsService,
    i18nMock as unknown as I18nService,
    configMock as unknown as ConfigService,
  );

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('answers 404 unless a published product has the slug', async () => {
    productsRepository.findOneBy.mockResolvedValue(null);

    await expect(service.share('ao-thun')).rejects.toThrow(
      new NotFoundException('products.NOT_FOUND'),
    );
    expect(productsRepository.findOneBy).toHaveBeenCalledWith({
      slug: 'ao-thun',
      status: ProductStatus.Published,
    });
  });

  it('shares the product with its thumbnail on the API origin', async () => {
    productsRepository.findOneBy.mockResolvedValue(PRODUCT);
    thumbnailsMock.urlsOf.mockResolvedValue(
      new Map([['p1', '/api/v1/attachments/a1']]),
    );

    await expect(service.share('ao-thun')).resolves.toMatchObject({
      url: 'https://shop.example.com/products/ao-thun',
      title: 'Áo thun',
      description: 'Vải cotton.',
      image: 'https://api.example.com/api/v1/attachments/a1',
    });
    expect(thumbnailsMock.urlsOf).toHaveBeenCalledWith(['p1']);
  });

  it('shares a product without a thumbnail', async () => {
    productsRepository.findOneBy.mockResolvedValue(PRODUCT);
    thumbnailsMock.urlsOf.mockResolvedValue(new Map());

    await expect(service.share('ao-thun')).resolves.toMatchObject({
      image: null,
    });
  });
});
