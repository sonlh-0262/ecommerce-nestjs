import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';

import { ApiErrorResponse } from '../common/decorators/api-error-response.decorator';
import { ParseUuidPipe } from '../common/pipes/parse-uuid.pipe';
import { CurrentShop } from '../shops/decorators/current-shop.decorator';
import { SellerOnly } from '../shops/decorators/seller-only.decorator';
import { Shop } from '../shops/entities/shop.entity';
import { ProductResponseDto, ProductsResponseDto } from './dto/product.dto';
import {
  SellerCreateProductDto,
  SellerProductsQueryDto,
  SellerUpdateProductDto,
} from './dto/seller-product.dto';
import { ProductsViewService } from './products-view.service';
import { ProductsService } from './products.service';

@ApiTags('Seller - Products')
@SellerOnly()
@Controller('seller/products')
export class ProductsSellerController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly view: ProductsViewService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List the products of my shop',
    description:
      'Every status, with the filters of GET /admin/products except ' +
      '`shop`. Deleted products are left out unless `includeDeleted` is true.',
  })
  @ApiOkResponse({ type: ProductsResponseDto })
  @ApiErrorResponse(HttpStatus.BAD_REQUEST, 'A query parameter is invalid.')
  list(
    @CurrentShop() shop: Shop,
    @Query() query: SellerProductsQueryDto,
  ): Promise<ProductsResponseDto> {
    return this.view.shopList(shop.id, query);
  }

  @Post()
  @ApiOperation({
    summary: 'Add a product to my shop',
    description:
      'Same rules as POST /admin/products, except that featuring a product ' +
      'is left to the platform.',
  })
  @ApiCreatedResponse({ type: ProductResponseDto })
  @ApiErrorResponse(HttpStatus.BAD_REQUEST, 'The payload failed validation.')
  @ApiErrorResponse(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'The category does not exist, the sale price is not below the price, ' +
      'or the status is PUBLISHED.',
  )
  async create(
    @CurrentShop() shop: Shop,
    @Body() dto: SellerCreateProductDto,
  ): Promise<ProductResponseDto> {
    return this.view.toResponse(
      await this.productsService.create(dto.product, shop.id),
    );
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a product of my shop',
    description: 'Partial update. Renaming keeps the slug.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: ProductResponseDto })
  @ApiErrorResponse(
    HttpStatus.BAD_REQUEST,
    'The id is not a uuid, or the payload failed validation.',
  )
  @ApiErrorResponse(
    HttpStatus.NOT_FOUND,
    'My shop has no such product, or it was deleted.',
  )
  @ApiErrorResponse(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'The category does not exist, the sale price is not below the price, ' +
      'or the product has no image to be published with.',
  )
  async update(
    @CurrentShop() shop: Shop,
    @Param('id', ParseUuidPipe) id: string,
    @Body() dto: SellerUpdateProductDto,
  ): Promise<ProductResponseDto> {
    return this.view.toResponse(
      await this.productsService.update(id, dto.product, shop.id),
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a product of my shop',
    description:
      'Soft delete: the product becomes ARCHIVED and leaves every cart, ' +
      'while past orders keep it.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse({ description: 'Deleted.' })
  @ApiErrorResponse(HttpStatus.BAD_REQUEST, 'The id is not a uuid.')
  @ApiErrorResponse(
    HttpStatus.NOT_FOUND,
    'My shop has no such product, or it was deleted.',
  )
  remove(
    @CurrentShop() shop: Shop,
    @Param('id', ParseUuidPipe) id: string,
  ): Promise<void> {
    return this.productsService.remove(id, shop.id);
  }
}
