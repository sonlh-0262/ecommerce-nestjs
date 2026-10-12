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
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';

import { SWAGGER_BEARER_AUTH_NAME } from '../common/constants/swagger';
import { ApiErrorResponse } from '../common/decorators/api-error-response.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ParseUuidPipe } from '../common/pipes/parse-uuid.pipe';
import { UserRole } from '../users/enums/user-role.enum';
import { AdminProductsQueryDto } from './dto/admin-products-query.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { ProductResponseDto, ProductsResponseDto } from './dto/product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductsViewService } from './products-view.service';
import { ProductsService } from './products.service';

@ApiTags('Admin - Products')
@ApiBearerAuth(SWAGGER_BEARER_AUTH_NAME)
@ApiErrorResponse(HttpStatus.UNAUTHORIZED, 'Missing, invalid or revoked token.')
@ApiErrorResponse(
  HttpStatus.FORBIDDEN,
  'The caller is not an admin, or has been locked.',
)
@Roles(UserRole.Admin)
@Controller('admin/products')
export class ProductsAdminController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly view: ProductsViewService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List products in any status',
    description:
      'The filters of GET /products, plus `status`. Deleted products are ' +
      'left out unless `includeDeleted` is true.',
  })
  @ApiOkResponse({ type: ProductsResponseDto })
  @ApiErrorResponse(HttpStatus.BAD_REQUEST, 'A query parameter is invalid.')
  list(@Query() query: AdminProductsQueryDto): Promise<ProductsResponseDto> {
    return this.view.adminList(query);
  }

  @Post()
  @ApiOperation({
    summary: 'Create a product',
    description:
      'Created without images, so it cannot start PUBLISHED: upload images, ' +
      'then publish with PATCH. The slug comes from the name, with -2, -3... ' +
      'appended when taken; a deleted product frees its slug.',
  })
  @ApiCreatedResponse({ type: ProductResponseDto })
  @ApiErrorResponse(HttpStatus.BAD_REQUEST, 'The payload failed validation.')
  @ApiErrorResponse(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'The category does not exist, the sale price is not below the price, ' +
      'or the status is PUBLISHED.',
  )
  async create(@Body() dto: CreateProductDto): Promise<ProductResponseDto> {
    return this.view.toResponse(await this.productsService.create(dto.product));
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a product',
    description:
      'Partial update. Renaming keeps the slug. Publishing needs at least ' +
      'one image.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: ProductResponseDto })
  @ApiErrorResponse(
    HttpStatus.BAD_REQUEST,
    'The id is not a uuid, or the payload failed validation.',
  )
  @ApiErrorResponse(HttpStatus.NOT_FOUND, 'No such product, or it was deleted.')
  @ApiErrorResponse(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'The category does not exist, the sale price is not below the price, ' +
      'or the product has no image to be published with.',
  )
  async update(
    @Param('id', ParseUuidPipe) id: string,
    @Body() dto: UpdateProductDto,
  ): Promise<ProductResponseDto> {
    return this.view.toResponse(
      await this.productsService.update(id, dto.product),
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a product',
    description:
      'Soft delete: the product becomes ARCHIVED and leaves every cart, ' +
      'while past orders keep it. Its slug can be reused by a new product.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse({ description: 'Deleted.' })
  @ApiErrorResponse(HttpStatus.BAD_REQUEST, 'The id is not a uuid.')
  @ApiErrorResponse(HttpStatus.NOT_FOUND, 'No such product, or it was deleted.')
  remove(@Param('id', ParseUuidPipe) id: string): Promise<void> {
    return this.productsService.remove(id);
  }
}
