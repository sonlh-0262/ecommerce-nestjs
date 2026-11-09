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
import { ParseUuidPipe } from '../common/pipes/parse-uuid.pipe';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/enums/user-role.enum';
import { AdminShopsQueryDto } from './dto/admin-shops-query.dto';
import { ReviewShopDto } from './dto/review-shop.dto';
import {
  AdminShopResponseDto,
  AdminShopsResponseDto,
  toAdminShopResponse,
  toAdminShopsResponse,
} from './dto/shop.dto';
import { ShopsViewService } from './shops-view.service';
import { ShopsService } from './shops.service';

@ApiTags('Admin - Shops')
@ApiBearerAuth(SWAGGER_BEARER_AUTH_NAME)
@ApiErrorResponse(HttpStatus.UNAUTHORIZED, 'Missing, invalid or revoked token.')
@ApiErrorResponse(
  HttpStatus.FORBIDDEN,
  'The caller is not an admin, or has been locked.',
)
@Roles(UserRole.Admin)
@Controller('admin/shops')
export class ShopsAdminController {
  constructor(
    private readonly shops: ShopsService,
    private readonly view: ShopsViewService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List shops',
    description: 'Newest first, with who owns each one.',
  })
  @ApiOkResponse({ type: AdminShopsResponseDto })
  @ApiErrorResponse(HttpStatus.BAD_REQUEST, 'A query parameter is invalid.')
  async list(
    @Query() query: AdminShopsQueryDto,
  ): Promise<AdminShopsResponseDto> {
    return toAdminShopsResponse(await this.view.adminList(query));
  }

  @Patch(':id/status')
  @ApiOperation({
    summary: 'Approve or reject a shop application',
    description:
      'Only once, while it is PENDING. Rejecting needs a reason. The owner ' +
      'is emailed either way; an approved owner can sell straight away.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: AdminShopResponseDto })
  @ApiErrorResponse(
    HttpStatus.BAD_REQUEST,
    'The id is not a uuid, or the payload failed validation.',
  )
  @ApiErrorResponse(HttpStatus.NOT_FOUND, 'No shop has this id.')
  @ApiErrorResponse(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'The shop was already reviewed, or a rejection has no reason.',
  )
  async review(
    @CurrentUser() admin: User,
    @Param('id', ParseUuidPipe) id: string,
    @Body() dto: ReviewShopDto,
  ): Promise<AdminShopResponseDto> {
    return toAdminShopResponse(await this.shops.review(admin, id, dto.shop));
  }
}
