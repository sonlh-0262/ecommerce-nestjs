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
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ParseUuidPipe } from '../common/pipes/parse-uuid.pipe';
import { User } from '../users/entities/user.entity';
import { CartService } from './cart.service';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import {
  CartResponseDto,
  InsufficientStockErrorResponseDto,
  toCartResponse,
} from './dto/cart.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';

@ApiTags('Cart')
@ApiBearerAuth(SWAGGER_BEARER_AUTH_NAME)
@ApiErrorResponse(HttpStatus.UNAUTHORIZED, 'Missing, invalid or revoked token.')
@ApiErrorResponse(HttpStatus.FORBIDDEN, 'The account has been locked.')
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  @ApiOperation({
    summary: 'Get my cart',
    description:
      'Prices are the current ones. An empty cart is returned until the ' +
      'first item is added.',
  })
  @ApiOkResponse({ type: CartResponseDto })
  async view(@CurrentUser() user: User): Promise<CartResponseDto> {
    return toCartResponse(await this.cartService.view(user.id));
  }

  @Post('items')
  @ApiOperation({
    summary: 'Add a product to my cart',
    description:
      'Adding a product already in the cart adds to its quantity. The ' +
      'whole cart is returned.',
  })
  @ApiCreatedResponse({ type: CartResponseDto })
  @ApiErrorResponse(HttpStatus.BAD_REQUEST, 'The payload failed validation.')
  @ApiErrorResponse(HttpStatus.NOT_FOUND, 'No product on sale has this id.')
  @ApiErrorResponse(
    HttpStatus.CONFLICT,
    'The product is out of stock, or the cart would hold more than the ' +
      'stock; `availableStock` says how many are left.',
    InsufficientStockErrorResponseDto,
  )
  @ApiErrorResponse(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'The cart would hold more than the per-product limit.',
  )
  async addItem(
    @CurrentUser() user: User,
    @Body() dto: AddCartItemDto,
  ): Promise<CartResponseDto> {
    return toCartResponse(await this.cartService.addItem(user.id, dto.item));
  }

  @Patch('items/:itemId')
  @ApiOperation({
    summary: 'Change the quantity of an item',
    description: 'Sets the quantity. The whole cart is returned.',
  })
  @ApiParam({ name: 'itemId', format: 'uuid' })
  @ApiOkResponse({ type: CartResponseDto })
  @ApiErrorResponse(
    HttpStatus.BAD_REQUEST,
    'The id is not a uuid, or the payload failed validation.',
  )
  @ApiErrorResponse(
    HttpStatus.NOT_FOUND,
    'No such item in my cart, or its product is no longer on sale.',
  )
  @ApiErrorResponse(
    HttpStatus.CONFLICT,
    'The quantity is above the stock; `availableStock` says how many are ' +
      'left.',
    InsufficientStockErrorResponseDto,
  )
  async updateItem(
    @CurrentUser() user: User,
    @Param('itemId', ParseUuidPipe) itemId: string,
    @Body() dto: UpdateCartItemDto,
  ): Promise<CartResponseDto> {
    return toCartResponse(
      await this.cartService.updateItem(user.id, itemId, dto.item),
    );
  }

  @Delete('items/:itemId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove an item from my cart' })
  @ApiParam({ name: 'itemId', format: 'uuid' })
  @ApiNoContentResponse({ description: 'Removed.' })
  @ApiErrorResponse(HttpStatus.BAD_REQUEST, 'The id is not a uuid.')
  @ApiErrorResponse(HttpStatus.NOT_FOUND, 'No such item in my cart.')
  removeItem(
    @CurrentUser() user: User,
    @Param('itemId', ParseUuidPipe) itemId: string,
  ): Promise<void> {
    return this.cartService.removeItem(user.id, itemId);
  }

  @Delete('items')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Empty my cart' })
  @ApiNoContentResponse({ description: 'Emptied.' })
  clear(@CurrentUser() user: User): Promise<void> {
    return this.cartService.clear(user.id);
  }
}
