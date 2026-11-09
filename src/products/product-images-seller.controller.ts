import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UploadedFiles,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';

import { UploadImages } from '../attachments/upload/upload-image.decorator';
import { ApiErrorResponse } from '../common/decorators/api-error-response.decorator';
import { ParseUuidPipe } from '../common/pipes/parse-uuid.pipe';
import { CurrentShop } from '../shops/decorators/current-shop.decorator';
import { SellerOnly } from '../shops/decorators/seller-only.decorator';
import { Shop } from '../shops/entities/shop.entity';
import { AddProductImagesDto } from './dto/add-product-images.dto';
import { ProductImagesResponseDto, toProductImageDto } from './dto/product.dto';
import { ProductImagesService } from './product-images.service';
import {
  MAX_PRODUCT_IMAGES,
  PRODUCT_IMAGES_UPLOAD,
} from './products.constants';

@ApiTags('Seller - Products')
@SellerOnly()
@Controller('seller/products/:id/images')
export class ProductImagesSellerController {
  constructor(private readonly productImages: ProductImagesService) {}

  @Post()
  @UploadImages(PRODUCT_IMAGES_UPLOAD, {
    isThumbnail: {
      type: 'boolean',
      description: 'Make the first file the thumbnail.',
    },
  })
  @ApiOperation({
    summary: 'Upload images of a product of my shop',
    description: `A product holds at most ${MAX_PRODUCT_IMAGES} images.`,
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiCreatedResponse({ type: ProductImagesResponseDto })
  @ApiErrorResponse(
    HttpStatus.NOT_FOUND,
    'My shop has no such product, or it was deleted.',
  )
  async add(
    @CurrentShop() shop: Shop,
    @Param('id', ParseUuidPipe) id: string,
    @UploadedFiles() files: Express.Multer.File[] | undefined,
    @Body() dto: AddProductImagesDto,
  ): Promise<ProductImagesResponseDto> {
    const images = await this.productImages.add(
      id,
      files,
      dto.isThumbnail,
      shop.id,
    );

    return { images: images.map(toProductImageDto) };
  }

  @Delete(':imageId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete an image of a product of my shop',
    description: 'Deleting the thumbnail promotes the next image by position.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiParam({ name: 'imageId', format: 'uuid' })
  @ApiNoContentResponse({ description: 'Deleted.' })
  @ApiErrorResponse(HttpStatus.BAD_REQUEST, 'An id is not a uuid.')
  @ApiErrorResponse(
    HttpStatus.NOT_FOUND,
    'My shop has no such product, or the image belongs to another one.',
  )
  @ApiErrorResponse(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'It is the last image of a published product.',
  )
  remove(
    @CurrentShop() shop: Shop,
    @Param('id', ParseUuidPipe) id: string,
    @Param('imageId', ParseUuidPipe) imageId: string,
  ): Promise<void> {
    return this.productImages.remove(id, imageId, shop.id);
  }
}
