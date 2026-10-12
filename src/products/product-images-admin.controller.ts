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
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';

import { UploadImages } from '../attachments/upload/upload-image.decorator';
import { SWAGGER_BEARER_AUTH_NAME } from '../common/constants/swagger';
import { ApiErrorResponse } from '../common/decorators/api-error-response.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ParseUuidPipe } from '../common/pipes/parse-uuid.pipe';
import { UserRole } from '../users/enums/user-role.enum';
import { AddProductImagesDto } from './dto/add-product-images.dto';
import { ProductImagesResponseDto, toProductImageDto } from './dto/product.dto';
import { ProductImagesService } from './product-images.service';
import {
  MAX_PRODUCT_IMAGES,
  PRODUCT_IMAGES_UPLOAD,
} from './products.constants';

@ApiTags('Admin - Products')
@ApiBearerAuth(SWAGGER_BEARER_AUTH_NAME)
@ApiErrorResponse(HttpStatus.UNAUTHORIZED, 'Missing, invalid or revoked token.')
@ApiErrorResponse(
  HttpStatus.FORBIDDEN,
  'The caller is not an admin, or has been locked.',
)
@Roles(UserRole.Admin)
@Controller('admin/products/:id/images')
export class ProductImagesAdminController {
  constructor(private readonly productImages: ProductImagesService) {}

  @Post()
  @UploadImages(PRODUCT_IMAGES_UPLOAD, {
    isThumbnail: {
      type: 'boolean',
      description: 'Make the first file the thumbnail.',
    },
  })
  @ApiOperation({
    summary: 'Upload product images',
    description:
      `A product holds at most ${MAX_PRODUCT_IMAGES} images, appended after ` +
      'the existing ones. The first image of a product without a ' +
      'thumbnail becomes its thumbnail.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiCreatedResponse({ type: ProductImagesResponseDto })
  @ApiErrorResponse(HttpStatus.NOT_FOUND, 'No such product, or it was deleted.')
  async add(
    @Param('id', ParseUuidPipe) id: string,
    @UploadedFiles() files: Express.Multer.File[] | undefined,
    @Body() dto: AddProductImagesDto,
  ): Promise<ProductImagesResponseDto> {
    const images = await this.productImages.add(id, files, dto.isThumbnail);

    return { images: images.map(toProductImageDto) };
  }

  @Delete(':imageId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a product image',
    description:
      'The file goes once the change commits. Deleting the thumbnail ' +
      'promotes the next image by position.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiParam({ name: 'imageId', format: 'uuid' })
  @ApiNoContentResponse({ description: 'Deleted.' })
  @ApiErrorResponse(HttpStatus.BAD_REQUEST, 'An id is not a uuid.')
  @ApiErrorResponse(
    HttpStatus.NOT_FOUND,
    'No such product, or the image belongs to another one.',
  )
  @ApiErrorResponse(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'It is the last image of a published product.',
  )
  remove(
    @Param('id', ParseUuidPipe) id: string,
    @Param('imageId', ParseUuidPipe) imageId: string,
  ): Promise<void> {
    return this.productImages.remove(id, imageId);
  }
}
