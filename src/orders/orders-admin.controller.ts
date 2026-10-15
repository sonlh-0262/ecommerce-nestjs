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
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';

import { SWAGGER_BEARER_AUTH_NAME } from '../common/constants/swagger';
import { ApiErrorResponse } from '../common/decorators/api-error-response.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/enums/user-role.enum';
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

@ApiTags('Admin - Orders')
@ApiBearerAuth(SWAGGER_BEARER_AUTH_NAME)
@ApiErrorResponse(HttpStatus.UNAUTHORIZED, 'Missing, invalid or revoked token.')
@ApiErrorResponse(
  HttpStatus.FORBIDDEN,
  'The caller is not an admin, or has been locked.',
)
@Roles(UserRole.Admin)
@Controller('admin/orders')
export class OrdersAdminController {
  constructor(
    private readonly ordersAdmin: OrdersAdminService,
    private readonly view: OrdersViewService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List every order',
    description:
      'Newest first, with who placed each one. `ordersCount` counts every ' +
      'matching order.',
  })
  @ApiOkResponse({ type: AdminOrdersResponseDto })
  @ApiErrorResponse(HttpStatus.BAD_REQUEST, 'A query parameter is invalid.')
  async list(
    @Query() query: AdminOrdersQueryDto,
  ): Promise<AdminOrdersResponseDto> {
    return toAdminOrdersResponse(await this.view.adminList(query));
  }

  @Get(':code')
  @ApiOperation({
    summary: 'Get an order',
    description:
      'With its customer, its items as priced when ordered, and who made ' +
      'each change in its history.',
  })
  @ApiParam({ name: 'code', example: 'ORD-20261005-0001' })
  @ApiOkResponse({ type: AdminOrderResponseDto })
  @ApiErrorResponse(HttpStatus.NOT_FOUND, 'No order has this code.')
  async findOne(@Param('code') code: string): Promise<AdminOrderResponseDto> {
    return toAdminOrderResponse(await this.view.adminFind(code));
  }

  @Patch(':code/status')
  @ApiOperation({
    summary: 'Move an order along its lifecycle',
    description:
      'PENDING -> CONFIRMED or REJECTED, CONFIRMED -> SHIPPING, SHIPPING -> ' +
      'DELIVERED. Rejecting needs a reason and puts the stock back; ' +
      'delivering marks a cash-on-delivery order paid. The customer is ' +
      'emailed on CONFIRMED and REJECTED. Setting the current status again ' +
      'is refused with 422, so a double click cannot send a second email.',
  })
  @ApiParam({ name: 'code', example: 'ORD-20261005-0001' })
  @ApiOkResponse({ type: AdminOrderResponseDto })
  @ApiErrorResponse(HttpStatus.BAD_REQUEST, 'The payload failed validation.')
  @ApiErrorResponse(HttpStatus.NOT_FOUND, 'No order has this code.')
  @ApiErrorResponse(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'The order cannot move from its current status to this one, or a ' +
      'rejection has no reason.',
  )
  async changeStatus(
    @CurrentUser() admin: User,
    @Param('code') code: string,
    @Body() dto: UpdateOrderStatusDto,
  ): Promise<AdminOrderResponseDto> {
    return toAdminOrderResponse(
      await this.ordersAdmin.changeStatus(admin, code, dto.order),
    );
  }
}
