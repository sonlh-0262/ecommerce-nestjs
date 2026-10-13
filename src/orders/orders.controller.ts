import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';

import { SWAGGER_BEARER_AUTH_NAME } from '../common/constants/swagger';
import { ApiErrorResponse } from '../common/decorators/api-error-response.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { CancelOrderDto } from './dto/cancel-order.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import {
  ItemsUnavailableErrorResponseDto,
  OrderResponseDto,
  OrdersResponseDto,
  toOrderResponse,
  toOrdersResponse,
} from './dto/order.dto';
import { OrdersQueryDto } from './dto/orders-query.dto';
import { PayOrderDto } from './dto/pay-order.dto';
import { OrdersViewService } from './orders-view.service';
import { OrdersService } from './orders.service';

@ApiTags('Orders')
@ApiBearerAuth(SWAGGER_BEARER_AUTH_NAME)
@ApiErrorResponse(HttpStatus.UNAUTHORIZED, 'Missing, invalid or revoked token.')
@ApiErrorResponse(HttpStatus.FORBIDDEN, 'The account has been locked.')
@Controller('orders')
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly view: OrdersViewService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Place an order from my cart',
    description:
      'Orders every item of the cart at its current price, takes the ' +
      'quantities out of the stock and empties the cart. The order starts ' +
      'PENDING and a confirmation email is sent.',
  })
  @ApiCreatedResponse({ type: OrderResponseDto })
  @ApiErrorResponse(HttpStatus.BAD_REQUEST, 'The payload failed validation.')
  @ApiErrorResponse(
    HttpStatus.CONFLICT,
    'Some items are no longer on sale or short of stock, and `items` lists ' +
      'them; or the daily order code sequence is exhausted.',
    ItemsUnavailableErrorResponseDto,
  )
  @ApiErrorResponse(HttpStatus.UNPROCESSABLE_ENTITY, 'The cart is empty.')
  async checkout(
    @CurrentUser() user: User,
    @Body() dto: CreateOrderDto,
  ): Promise<OrderResponseDto> {
    return toOrderResponse(await this.ordersService.checkout(user, dto.order));
  }

  @Get()
  @ApiOperation({
    summary: 'List my orders',
    description: 'Newest first. `ordersCount` counts every matching order.',
  })
  @ApiOkResponse({ type: OrdersResponseDto })
  @ApiErrorResponse(HttpStatus.BAD_REQUEST, 'A query parameter is invalid.')
  async list(
    @CurrentUser() user: User,
    @Query() query: OrdersQueryDto,
  ): Promise<OrdersResponseDto> {
    return toOrdersResponse(await this.view.list(user.id, query));
  }

  @Get(':code')
  @ApiOperation({
    summary: 'Get one of my orders',
    description: 'With its items, as priced when ordered, and its history.',
  })
  @ApiParam({ name: 'code', example: 'ORD-20261005-0001' })
  @ApiOkResponse({ type: OrderResponseDto })
  @ApiErrorResponse(HttpStatus.NOT_FOUND, 'I have no order with this code.')
  async findOne(
    @CurrentUser() user: User,
    @Param('code') code: string,
  ): Promise<OrderResponseDto> {
    return toOrderResponse(await this.view.findOwned(user.id, code));
  }

  @Post(':code/payment')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Declare a bank transfer',
    description:
      'Mock payment: records the transfer reference and marks the order ' +
      'PAID. No payment gateway is called; an admin reconciles by hand.',
  })
  @ApiParam({ name: 'code', example: 'ORD-20261005-0001' })
  @ApiOkResponse({ type: OrderResponseDto })
  @ApiErrorResponse(HttpStatus.BAD_REQUEST, 'The payload failed validation.')
  @ApiErrorResponse(HttpStatus.NOT_FOUND, 'I have no order with this code.')
  @ApiErrorResponse(HttpStatus.CONFLICT, 'The order is already paid.')
  @ApiErrorResponse(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'The order is not paid by bank transfer, or is no longer pending or ' +
      'confirmed.',
  )
  async pay(
    @CurrentUser() user: User,
    @Param('code') code: string,
    @Body() dto: PayOrderDto,
  ): Promise<OrderResponseDto> {
    return toOrderResponse(
      await this.ordersService.pay(user, code, dto.payment),
    );
  }

  @Post(':code/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cancel one of my orders',
    description:
      'Only while it is PENDING. The quantities go back into the stock.',
  })
  @ApiParam({ name: 'code', example: 'ORD-20261005-0001' })
  @ApiOkResponse({ type: OrderResponseDto })
  @ApiErrorResponse(HttpStatus.BAD_REQUEST, 'The payload failed validation.')
  @ApiErrorResponse(HttpStatus.NOT_FOUND, 'I have no order with this code.')
  @ApiErrorResponse(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'The order is no longer awaiting confirmation.',
  )
  async cancel(
    @CurrentUser() user: User,
    @Param('code') code: string,
    @Body() dto: CancelOrderDto,
  ): Promise<OrderResponseDto> {
    return toOrderResponse(
      await this.ordersService.cancel(user, code, dto.order),
    );
  }
}
