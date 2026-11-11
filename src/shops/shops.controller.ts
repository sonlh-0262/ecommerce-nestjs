import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  Patch,
  Post,
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
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/enums/user-role.enum';
import { CreateShopDto } from './dto/create-shop.dto';
import {
  PublicShopResponseDto,
  ShopResponseDto,
  toPublicShopResponse,
  toShopResponse,
} from './dto/shop.dto';
import { UpdateShopDto } from './dto/update-shop.dto';
import { MY_SHOP_SLUG } from './shops.constants';
import { ShopsViewService } from './shops-view.service';
import { ShopsService } from './shops.service';

@ApiTags('Shops')
@Controller('shops')
export class ShopsController {
  constructor(
    private readonly shops: ShopsService,
    private readonly view: ShopsViewService,
  ) {}

  @Post()
  @Roles(UserRole.User)
  @ApiBearerAuth(SWAGGER_BEARER_AUTH_NAME)
  @ApiOperation({
    summary: 'Apply to open a shop',
    description:
      'Starts PENDING until an admin reviews it. An account owns at most ' +
      'one shop; admins cannot open one.',
  })
  @ApiCreatedResponse({ type: ShopResponseDto })
  @ApiErrorResponse(HttpStatus.BAD_REQUEST, 'The payload failed validation.')
  @ApiErrorResponse(
    HttpStatus.UNAUTHORIZED,
    'Missing, invalid or revoked token.',
  )
  @ApiErrorResponse(HttpStatus.FORBIDDEN, 'The caller is an admin, or locked.')
  @ApiErrorResponse(HttpStatus.CONFLICT, 'The caller already has a shop.')
  async apply(
    @CurrentUser() user: User,
    @Body() dto: CreateShopDto,
  ): Promise<ShopResponseDto> {
    return toShopResponse(await this.shops.apply(user, dto.shop));
  }

  @Get(MY_SHOP_SLUG)
  @ApiBearerAuth(SWAGGER_BEARER_AUTH_NAME)
  @ApiOperation({
    summary: 'Get my shop',
    description: 'With its review status and, once rejected, the reason.',
  })
  @ApiOkResponse({ type: ShopResponseDto })
  @ApiErrorResponse(
    HttpStatus.UNAUTHORIZED,
    'Missing, invalid or revoked token.',
  )
  @ApiErrorResponse(HttpStatus.FORBIDDEN, 'The account has been locked.')
  @ApiErrorResponse(HttpStatus.NOT_FOUND, 'The caller has no shop.')
  async findMine(@CurrentUser() user: User): Promise<ShopResponseDto> {
    return toShopResponse(await this.view.findMine(user.id));
  }

  @Patch(MY_SHOP_SLUG)
  @ApiBearerAuth(SWAGGER_BEARER_AUTH_NAME)
  @ApiOperation({
    summary: 'Update my shop',
    description:
      'Partial update. Renaming keeps the slug. Updating a REJECTED shop ' +
      'sends it back to PENDING for another review.',
  })
  @ApiOkResponse({ type: ShopResponseDto })
  @ApiErrorResponse(HttpStatus.BAD_REQUEST, 'The payload failed validation.')
  @ApiErrorResponse(
    HttpStatus.UNAUTHORIZED,
    'Missing, invalid or revoked token.',
  )
  @ApiErrorResponse(HttpStatus.FORBIDDEN, 'The account has been locked.')
  @ApiErrorResponse(HttpStatus.NOT_FOUND, 'The caller has no shop.')
  async updateMine(
    @CurrentUser() user: User,
    @Body() dto: UpdateShopDto,
  ): Promise<ShopResponseDto> {
    return toShopResponse(await this.shops.updateMine(user, dto.shop));
  }

  @Get(':slug')
  @Public()
  @ApiOperation({
    summary: 'Get a shop',
    description: 'Only an ACTIVE shop is visible.',
  })
  @ApiParam({ name: 'slug', example: 'nha-sach-ha-noi' })
  @ApiOkResponse({ type: PublicShopResponseDto })
  @ApiErrorResponse(HttpStatus.NOT_FOUND, 'No active shop has this slug.')
  async findOne(@Param('slug') slug: string): Promise<PublicShopResponseDto> {
    return toPublicShopResponse(await this.view.findPublic(slug));
  }
}
