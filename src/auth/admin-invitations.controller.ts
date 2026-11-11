import { Body, Controller, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { SWAGGER_BEARER_AUTH_NAME } from '../common/constants/swagger';
import { MINUTES_PER_HOUR } from '../common/constants/time';
import { ApiErrorResponse } from '../common/decorators/api-error-response.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { toUserResponse, UserResponseDto } from '../users/dto/user.dto';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/enums/user-role.enum';
import { UserTokenType } from '../users/enums/user-token-type.enum';
import { USER_TOKEN_TTL_MINUTES } from '../users/users.constants';
import { InviteAdminDto } from './dto/invite-admin.dto';
import { RegistrationService } from './registration.service';

@ApiTags('Admin - Users')
@ApiBearerAuth(SWAGGER_BEARER_AUTH_NAME)
@ApiErrorResponse(HttpStatus.UNAUTHORIZED, 'Missing, invalid or revoked token.')
@ApiErrorResponse(
  HttpStatus.FORBIDDEN,
  'The caller is not an admin, or has been locked.',
)
@Roles(UserRole.Admin)
@Controller('admin/admins')
export class AdminInvitationsController {
  constructor(private readonly registrationService: RegistrationService) {}

  @Post()
  @ApiOperation({
    summary: 'Invite an admin',
    description:
      'Creates a PENDING admin account and emails it a link to set its ' +
      `password, valid for ${USER_TOKEN_TTL_MINUTES[UserTokenType.Invitation] / MINUTES_PER_HOUR} hours. ` +
      'The inviting admin never learns the password.',
  })
  @ApiCreatedResponse({ type: UserResponseDto })
  @ApiErrorResponse(HttpStatus.BAD_REQUEST, 'The payload failed validation.')
  @ApiErrorResponse(HttpStatus.CONFLICT, 'Email or username already taken.')
  async invite(
    @CurrentUser() admin: User,
    @Body() dto: InviteAdminDto,
  ): Promise<UserResponseDto> {
    return toUserResponse(
      await this.registrationService.inviteAdmin(admin, dto.admin),
    );
  }
}
