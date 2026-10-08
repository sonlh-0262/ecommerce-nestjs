import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Put,
  UploadedFile,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { I18nService } from 'nestjs-i18n';

import { UploadImage } from '../attachments/upload/upload-image.decorator';
import { SWAGGER_BEARER_AUTH_NAME } from '../common/constants/swagger';
import { ApiErrorResponse } from '../common/decorators/api-error-response.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { MessageResponseDto } from '../common/dto/message-response.dto';
import { RateLimit } from '../common/throttling/rate-limit.decorator';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { toUserResponse, UserResponseDto } from './dto/user.dto';
import { User } from './entities/user.entity';
import { ProfileService } from './profile.service';
import { UserAvatarsService } from './user-avatars.service';
import { USERS_RATE_LIMITS } from './users.constants';

@ApiTags('Users')
@ApiBearerAuth(SWAGGER_BEARER_AUTH_NAME)
@ApiErrorResponse(HttpStatus.UNAUTHORIZED, 'Missing, invalid or revoked token.')
@ApiErrorResponse(HttpStatus.FORBIDDEN, 'The account has been locked.')
@Controller('users/me')
export class UsersController {
  constructor(
    private readonly profileService: ProfileService,
    private readonly avatars: UserAvatarsService,
    private readonly i18n: I18nService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get my profile' })
  @ApiOkResponse({ type: UserResponseDto })
  async getProfile(@CurrentUser() user: User): Promise<UserResponseDto> {
    return toUserResponse(user, await this.avatars.urlOf(user.id));
  }

  @Patch()
  @ApiOperation({
    summary: 'Update my profile',
    description:
      'Partial update: only the fields sent change, and null clears an ' +
      'optional field. Email, role and status cannot be changed here.',
  })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiErrorResponse(
    HttpStatus.BAD_REQUEST,
    'The payload failed validation or changes nothing.',
  )
  @ApiErrorResponse(HttpStatus.CONFLICT, 'The username is already taken.')
  async updateProfile(
    @CurrentUser() user: User,
    @Body() dto: UpdateProfileDto,
  ): Promise<UserResponseDto> {
    const updated = await this.profileService.updateProfile(user, dto.user);

    return toUserResponse(updated, await this.avatars.urlOf(updated.id));
  }

  @Put('password')
  @HttpCode(HttpStatus.OK)
  @RateLimit(USERS_RATE_LIMITS.changePassword)
  @ApiOperation({
    summary: 'Change my password',
    description:
      'Every token issued before the change, including the one used for ' +
      'this request, stops working: the client has to log in again.',
  })
  @ApiOkResponse({ type: MessageResponseDto })
  @ApiErrorResponse(HttpStatus.BAD_REQUEST, 'The payload failed validation.')
  @ApiErrorResponse(
    HttpStatus.UNAUTHORIZED,
    'The current password is wrong, or the token is missing or revoked.',
  )
  @ApiErrorResponse(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'The new password is the current one.',
  )
  @ApiErrorResponse(HttpStatus.TOO_MANY_REQUESTS, 'Too many requests.')
  async changePassword(
    @CurrentUser() user: User,
    @Body() dto: ChangePasswordDto,
  ): Promise<MessageResponseDto> {
    await this.profileService.changePassword(user, dto.user);

    return { message: this.i18n.t('users.PASSWORD_CHANGED') };
  }

  @Post('avatar')
  @HttpCode(HttpStatus.OK)
  @RateLimit(USERS_RATE_LIMITS.uploadAvatar)
  @UploadImage()
  @ApiOperation({
    summary: 'Upload my avatar',
    description:
      'Replaces the current avatar, if any. The old file is deleted once ' +
      'the new one is stored.',
  })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiErrorResponse(HttpStatus.TOO_MANY_REQUESTS, 'Too many requests.')
  async uploadAvatar(
    @CurrentUser() user: User,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<UserResponseDto> {
    return toUserResponse(user, await this.avatars.replace(user, file));
  }
}
