import { Controller, Get, HttpStatus, Param, Query } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';

import { ApiErrorResponse } from '../common/decorators/api-error-response.decorator';
import { Public } from '../common/decorators/public.decorator';
import { ProductResponseDto, ProductsResponseDto } from './dto/product.dto';
import {
  FeaturedProductsQueryDto,
  ProductsQueryDto,
} from './dto/products-query.dto';
import { ProductsViewService } from './products-view.service';
import { FEATURED_PRODUCTS_ROUTE } from './products.constants';

@ApiTags('Products')
@Public()
@Controller('products')
export class ProductsController {
  constructor(private readonly view: ProductsViewService) {}

  @Get()
  @ApiOperation({
    summary: 'List and search products',
    description:
      'Published products only. Newest first unless `sort` says otherwise.',
  })
  @ApiOkResponse({ type: ProductsResponseDto })
  @ApiErrorResponse(HttpStatus.BAD_REQUEST, 'A query parameter is invalid.')
  list(@Query() query: ProductsQueryDto): Promise<ProductsResponseDto> {
    return this.view.list(query);
  }

  @Get(FEATURED_PRODUCTS_ROUTE)
  @ApiOperation({
    summary: 'List featured products',
    description:
      'Best sellers first. Served from a cache for a few minutes; any admin ' +
      'change to a product clears it.',
  })
  @ApiOkResponse({ type: ProductsResponseDto })
  @ApiErrorResponse(HttpStatus.BAD_REQUEST, 'A query parameter is invalid.')
  featured(
    @Query() query: FeaturedProductsQueryDto,
  ): Promise<ProductsResponseDto> {
    return this.view.featured(query);
  }

  @Get(':slug')
  @ApiOperation({
    summary: 'Get a product',
    description:
      'With every image and its category. Drafts and archived products answer 404.',
  })
  @ApiParam({ name: 'slug', example: 'ao-thun-cotton-basic' })
  @ApiOkResponse({ type: ProductResponseDto })
  @ApiErrorResponse(HttpStatus.NOT_FOUND, 'No published product has this slug.')
  findOne(@Param('slug') slug: string): Promise<ProductResponseDto> {
    return this.view.findPublishedBySlug(slug);
  }
}
