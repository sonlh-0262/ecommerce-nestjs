import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { I18nService } from 'nestjs-i18n';

import { SWAGGER_BEARER_AUTH_NAME } from '../common/constants/swagger';
import { CurrentToken } from '../common/decorators/current-token.decorator';
import { AuthService } from './auth.service';
import {
  AuthenticatedUserResponseDto,
  toAuthenticatedUserResponse,
} from './dto/authenticated-user.dto';
import { LoginUserDto } from './dto/login.dto';
import { LogoutResponseDto } from './dto/logout-response.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { TokenIdentity } from './interfaces/token-identity.interface';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly i18n: I18nService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Log in',
    description:
      'Exchanges a password for an access token. 200 rather than 201: no ' +
      'resource is created, the account already existed.',
  })
  @ApiOkResponse({ type: AuthenticatedUserResponseDto })
  @ApiBadRequestResponse({ description: 'The payload failed validation.' })
  @ApiUnauthorizedResponse({ description: 'Email or password is incorrect.' })
  @ApiForbiddenResponse({
    description: 'The account is not activated, or has been locked.',
  })
  async login(
    @Body() dto: LoginUserDto,
  ): Promise<AuthenticatedUserResponseDto> {
    const { user, session } = await this.authService.login(dto.user);

    return toAuthenticatedUserResponse(user, session);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth(SWAGGER_BEARER_AUTH_NAME)
  @ApiOperation({
    summary: 'Log out',
    description:
      'Revokes the access token used to make this request by adding it to a ' +
      'Redis denylist, where it stays until it would have expired anyway.',
  })
  @ApiOkResponse({ type: LogoutResponseDto })
  @ApiUnauthorizedResponse({
    description: 'Missing, invalid or already revoked token.',
  })
  @ApiForbiddenResponse({
    description: 'The account has been locked since the token was issued.',
  })
  async logout(
    @CurrentToken() token: TokenIdentity,
  ): Promise<LogoutResponseDto> {
    await this.authService.logout(token.jti, token.expiresAt);

    return { message: this.i18n.t('auth.LOGGED_OUT') };
  }
}
