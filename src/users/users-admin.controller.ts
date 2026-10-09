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
import { paginated } from '../common/helpers/paginated';
import { ParseUuidPipe } from '../common/pipes/parse-uuid.pipe';
import {
  AdminUserResponseDto,
  toAdminUserResponse,
  UsersResponseDto,
} from './dto/admin-user.dto';
import { AdminUsersQueryDto } from './dto/admin-users-query.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { toUserDto, toUserResponse, UserResponseDto } from './dto/user.dto';
import { User } from './entities/user.entity';
import { UserRole } from './enums/user-role.enum';
import { UserAvatarsService } from './user-avatars.service';
import { UsersAdminService } from './users-admin.service';

@ApiTags('Admin - Users')
@ApiBearerAuth(SWAGGER_BEARER_AUTH_NAME)
@ApiErrorResponse(HttpStatus.UNAUTHORIZED, 'Missing, invalid or revoked token.')
@ApiErrorResponse(
  HttpStatus.FORBIDDEN,
  'The caller is not an admin, or has been locked.',
)
@Roles(UserRole.Admin)
@Controller('admin/users')
export class UsersAdminController {
  constructor(
    private readonly usersAdmin: UsersAdminService,
    private readonly avatars: UserAvatarsService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List accounts',
    description: 'Newest first. `usersCount` counts every matching account.',
  })
  @ApiOkResponse({ type: UsersResponseDto })
  @ApiErrorResponse(HttpStatus.BAD_REQUEST, 'A query parameter is invalid.')
  async list(@Query() query: AdminUsersQueryDto): Promise<UsersResponseDto> {
    const [users, total] = await this.usersAdmin.list(query);
    const avatarUrls = await this.avatars.urlsOf(users.map(({ id }) => id));

    return paginated(
      'users',
      users.map((user) => toUserDto(user, avatarUrls.get(user.id) ?? null)),
      total,
    );
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get an account',
    description: 'Includes how many orders it placed and how much it spent.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: AdminUserResponseDto })
  @ApiErrorResponse(HttpStatus.BAD_REQUEST, 'The id is not a uuid.')
  @ApiErrorResponse(HttpStatus.NOT_FOUND, 'No such account.')
  async findOne(
    @Param('id', ParseUuidPipe) id: string,
  ): Promise<AdminUserResponseDto> {
    const user = await this.usersAdmin.findOne(id);
    const [avatarUrl, stats] = await Promise.all([
      this.avatars.urlOf(user.id),
      this.usersAdmin.orderStats(user.id),
    ]);

    return toAdminUserResponse(user, avatarUrl, stats);
  }

  @Patch(':id/status')
  @ApiOperation({
    summary: 'Lock or unlock an account',
    description:
      'A locked account is refused from its very next request, including ' +
      'the tokens it already holds. Setting the current status is a no-op.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiErrorResponse(HttpStatus.BAD_REQUEST, 'The payload failed validation.')
  @ApiErrorResponse(HttpStatus.NOT_FOUND, 'No such account.')
  @ApiErrorResponse(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'The account is the caller, or has not verified its email.',
  )
  async setStatus(
    @CurrentUser() admin: User,
    @Param('id', ParseUuidPipe) id: string,
    @Body() dto: UpdateUserStatusDto,
  ): Promise<UserResponseDto> {
    const user = await this.usersAdmin.setStatus(admin, id, dto.user.status);

    return toUserResponse(user, await this.avatars.urlOf(user.id));
  }
}
