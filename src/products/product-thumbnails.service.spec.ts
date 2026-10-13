import { In, Repository } from 'typeorm';

import { ProductImage } from './entities/product-image.entity';
import { ProductThumbnailsService } from './product-thumbnails.service';

describe('ProductThumbnailsService', () => {
  const imagesRepository = { find: jest.fn() };
  const service = new ProductThumbnailsService(
    imagesRepository as unknown as Repository<ProductImage>,
  );

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('loads the thumbnails of every product in one query', async () => {
    imagesRepository.find.mockResolvedValue([
      { productId: 'p1', attachment: { url: '/api/v1/attachments/a1' } },
    ]);

    const urls = await service.urlsOf(['p1', 'p2', 'p1']);

    expect(imagesRepository.find).toHaveBeenCalledWith({
      where: { productId: In(['p1', 'p2']), isThumbnail: true },
      relations: { attachment: true },
    });
    expect(urls).toEqual(new Map([['p1', '/api/v1/attachments/a1']]));
  });

  it('skips the query when there is no product', async () => {
    await expect(service.urlsOf([])).resolves.toEqual(new Map());
    expect(imagesRepository.find).not.toHaveBeenCalled();
  });
});
