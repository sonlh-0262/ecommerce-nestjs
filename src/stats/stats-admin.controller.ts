import { Controller, Get, HttpStatus, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { SWAGGER_BEARER_AUTH_NAME } from '../common/constants/swagger';
import { ApiErrorResponse } from '../common/decorators/api-error-response.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';
import { BestSellersQueryDto } from './dto/best-sellers-query.dto';
import { RevenueQueryDto } from './dto/revenue-query.dto';
import { StatsRangeQueryDto } from './dto/stats-range-query.dto';
import {
  BestSellersResponseDto,
  RevenueResponseDto,
  StatsOverviewResponseDto,
  toBestSellersResponse,
  toRevenueResponse,
  toStatsOverviewResponse,
} from './dto/stats.dto';
import { StatsService } from './stats.service';

@ApiTags('Admin - Statistics')
@ApiBearerAuth(SWAGGER_BEARER_AUTH_NAME)
@ApiErrorResponse(HttpStatus.BAD_REQUEST, 'A query parameter is invalid.')
@ApiErrorResponse(HttpStatus.UNAUTHORIZED, 'Missing, invalid or revoked token.')
@ApiErrorResponse(
  HttpStatus.FORBIDDEN,
  'The caller is not an admin, or has been locked.',
)
@Roles(UserRole.Admin)
@Controller('admin/stats')
export class StatsAdminController {
  constructor(private readonly stats: StatsService) {}

  @Get('overview')
  @ApiOperation({
    summary: 'Shop figures over a period',
    description:
      'Revenue only counts DELIVERED orders, by the day they were ' +
      'delivered; `totalOrders` and `ordersByStatus` count the orders ' +
      'placed in the range, by the day they were created. Served from a ' +
      'cache for 5 minutes.',
  })
  @ApiOkResponse({ type: StatsOverviewResponseDto })
  @ApiErrorResponse(HttpStatus.UNPROCESSABLE_ENTITY, '`from` is after `to`.')
  async overview(
    @Query() query: StatsRangeQueryDto,
  ): Promise<StatsOverviewResponseDto> {
    return toStatsOverviewResponse(await this.stats.overview(query));
  }

  @Get('best-sellers')
  @ApiOperation({
    summary: 'Products that sold the most over a period',
    description:
      'Units of DELIVERED orders, by delivery date. A product deleted since ' +
      'still appears, flagged `isDeleted`, because it was really sold.',
  })
  @ApiOkResponse({ type: BestSellersResponseDto })
  @ApiErrorResponse(HttpStatus.UNPROCESSABLE_ENTITY, '`from` is after `to`.')
  async bestSellers(
    @Query() query: BestSellersQueryDto,
  ): Promise<BestSellersResponseDto> {
    return toBestSellersResponse(await this.stats.bestSellers(query));
  }

  @Get('revenue')
  @ApiOperation({
    summary: 'Revenue per month or per year',
    description:
      'DELIVERED orders by delivery date, grouped in the shop time zone. ' +
      'Every period of the window is listed, at 0 when nothing was delivered.',
  })
  @ApiOkResponse({ type: RevenueResponseDto })
  async revenue(@Query() query: RevenueQueryDto): Promise<RevenueResponseDto> {
    return toRevenueResponse(await this.stats.revenue(query));
  }
}
