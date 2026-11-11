import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  Patch,
  Query,
} from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';

import { ApiErrorResponse } from '../common/decorators/api-error-response.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CurrentShop } from '../shops/decorators/current-shop.decorator';
import { SellerOnly } from '../shops/decorators/seller-only.decorator';
import { Shop } from '../shops/entities/shop.entity';
import { User } from '../users/entities/user.entity';
import {
  AdminOrderResponseDto,
  AdminOrdersResponseDto,
  toAdminOrderResponse,
  toAdminOrdersResponse,
} from './dto/admin-order.dto';
import { AdminOrdersQueryDto } from './dto/admin-orders-query.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrdersAdminService } from './orders-admin.service';
import { OrdersViewService } from './orders-view.service';

@ApiTags('Seller - Orders')
@SellerOnly()
@Controller('seller/orders')
export class OrdersSellerController {
  constructor(
    private readonly ordersAdmin: OrdersAdminService,
    private readonly view: OrdersViewService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List the orders of my shop',
    description:
      'Newest first, with who placed each one, so the shop can contact the ' +
      'customer. `ordersCount` counts every matching order.',
  })
  @ApiOkResponse({ type: AdminOrdersResponseDto })
  @ApiErrorResponse(HttpStatus.BAD_REQUEST, 'A query parameter is invalid.')
  async list(
    @CurrentShop() shop: Shop,
    @Query() query: AdminOrdersQueryDto,
  ): Promise<AdminOrdersResponseDto> {
    return toAdminOrdersResponse(await this.view.shopList(shop.id, query));
  }

  @Get(':code')
  @ApiOperation({
    summary: 'Get an order of my shop',
    description: 'With its customer, its items and its history.',
  })
  @ApiParam({ name: 'code', example: 'ORD-20261105-0001' })
  @ApiOkResponse({ type: AdminOrderResponseDto })
  @ApiErrorResponse(
    HttpStatus.NOT_FOUND,
    'My shop has no order with this code.',
  )
  async findOne(
    @CurrentShop() shop: Shop,
    @Param('code') code: string,
  ): Promise<AdminOrderResponseDto> {
    return toAdminOrderResponse(await this.view.shopFind(shop.id, code));
  }

  @Patch(':code/status')
  @ApiOperation({
    summary: 'Confirm, reject, ship or deliver an order of my shop',
    description:
      'The lifecycle and rules of PATCH /admin/orders/:code/status: ' +
      'rejecting needs a reason and puts the stock back, delivering marks a ' +
      'cash-on-delivery order paid, and the customer is emailed on ' +
      'CONFIRMED and REJECTED.',
  })
  @ApiParam({ name: 'code', example: 'ORD-20261105-0001' })
  @ApiOkResponse({ type: AdminOrderResponseDto })
  @ApiErrorResponse(HttpStatus.BAD_REQUEST, 'The payload failed validation.')
  @ApiErrorResponse(
    HttpStatus.NOT_FOUND,
    'My shop has no order with this code.',
  )
  @ApiErrorResponse(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'The order cannot move from its current status to this one, or a ' +
      'rejection has no reason.',
  )
  async changeStatus(
    @CurrentUser() seller: User,
    @CurrentShop() shop: Shop,
    @Param('code') code: string,
    @Body() dto: UpdateOrderStatusDto,
  ): Promise<AdminOrderResponseDto> {
    return toAdminOrderResponse(
      await this.ordersAdmin.changeStatus(seller, code, dto.order, shop.id),
    );
  }
}
