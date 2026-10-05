import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { I18nService } from 'nestjs-i18n';

import { SWAGGER_BEARER_AUTH_NAME } from '../common/constants/swagger';
import { ApiErrorResponse } from '../common/decorators/api-error-response.decorator';
import { CurrentToken } from '../common/decorators/current-token.decorator';
import { Public } from '../common/decorators/public.decorator';
import { MessageResponseDto } from '../common/dto/message-response.dto';
import { RateLimit } from '../common/throttling/rate-limit.decorator';
import { toUserResponse, UserResponseDto } from '../users/dto/user.dto';
import { AUTH_RATE_LIMITS } from './auth.constants';
import { AuthService } from './auth.service';
import { AccountEmailDto } from './dto/account-email.dto';
import {
  AuthenticatedUserResponseDto,
  toAuthenticatedUserResponse,
} from './dto/authenticated-user.dto';
import { LoginUserDto } from './dto/login.dto';
import { RegisterUserDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UserTokenDto } from './dto/user-token.dto';
import { TokenIdentity } from './interfaces/token-identity.interface';
import { PasswordResetService } from './password-reset.service';
import { RegistrationService } from './registration.service';

@ApiTags('Auth')
@ApiErrorResponse(HttpStatus.BAD_REQUEST, 'The payload failed validation.')
@ApiErrorResponse(HttpStatus.TOO_MANY_REQUESTS, 'Too many requests.')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly registrationService: RegistrationService,
    private readonly passwordResetService: PasswordResetService,
    private readonly i18n: I18nService,
  ) {}

  @Post('register')
  @Public()
  @RateLimit(AUTH_RATE_LIMITS.register)
  @ApiOperation({
    summary: 'Register',
    description:
      'Creates a PENDING account and emails an activation link. No token is ' +
      'returned: the account cannot log in until the email is confirmed.',
  })
  @ApiCreatedResponse({ type: UserResponseDto })
  @ApiErrorResponse(HttpStatus.CONFLICT, 'Email or username already taken.')
  async register(@Body() dto: RegisterUserDto): Promise<UserResponseDto> {
    return toUserResponse(await this.registrationService.register(dto.user));
  }

  @Post('verify-email')
  @Public()
  @HttpCode(HttpStatus.OK)
  @RateLimit(AUTH_RATE_LIMITS.verifyEmail)
  @ApiOperation({
    summary: 'Confirm an email address',
    description: 'Redeems the activation link and activates the account.',
  })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiErrorResponse(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'The link is unknown, already used or expired.',
  )
  async verifyEmail(@Body() dto: UserTokenDto): Promise<UserResponseDto> {
    return toUserResponse(
      await this.registrationService.verifyEmail(dto.token),
    );
  }

  @Post('resend-verification')
  @Public()
  @HttpCode(HttpStatus.OK)
  @RateLimit(AUTH_RATE_LIMITS.resendVerification)
  @ApiOperation({
    summary: 'Send the activation link again',
    description:
      'Always answers 200, so the endpoint cannot reveal which emails exist.',
  })
  @ApiOkResponse({ type: MessageResponseDto })
  async resendVerification(
    @Body() dto: AccountEmailDto,
  ): Promise<MessageResponseDto> {
    await this.registrationService.resendVerification(dto.email);

    return this.message('auth.VERIFICATION_SENT');
  }

  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @RateLimit(AUTH_RATE_LIMITS.login)
  @ApiOperation({
    summary: 'Log in',
    description:
      'Exchanges a password for an access token. 200 rather than 201: no ' +
      'resource is created, the account already existed.',
  })
  @ApiOkResponse({ type: AuthenticatedUserResponseDto })
  @ApiErrorResponse(HttpStatus.UNAUTHORIZED, 'Email or password is incorrect.')
  @ApiErrorResponse(
    HttpStatus.FORBIDDEN,
    'The account is not activated, or has been locked.',
  )
  async login(
    @Body() dto: LoginUserDto,
  ): Promise<AuthenticatedUserResponseDto> {
    const { user, session } = await this.authService.login(dto.user);

    return toAuthenticatedUserResponse(user, session);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth(SWAGGER_BEARER_AUTH_NAME)
  @ApiOperation({
    summary: 'Log out',
    description:
      'Revokes the access token used to make this request by adding it to a ' +
      'Redis denylist, where it stays until it would have expired anyway.',
  })
  @ApiOkResponse({ type: MessageResponseDto })
  @ApiErrorResponse(
    HttpStatus.UNAUTHORIZED,
    'Missing, invalid or already revoked token.',
  )
  @ApiErrorResponse(
    HttpStatus.FORBIDDEN,
    'The account has been locked since the token was issued.',
  )
  async logout(
    @CurrentToken() token: TokenIdentity,
  ): Promise<MessageResponseDto> {
    await this.authService.logout(token.jti, token.expiresAt);

    return this.message('auth.LOGGED_OUT');
  }

  @Post('forgot-password')
  @Public()
  @HttpCode(HttpStatus.OK)
  @RateLimit(AUTH_RATE_LIMITS.forgotPassword)
  @ApiOperation({
    summary: 'Request a password reset link',
    description:
      'Always answers 200, so the endpoint cannot reveal which emails exist.',
  })
  @ApiOkResponse({ type: MessageResponseDto })
  async forgotPassword(
    @Body() dto: AccountEmailDto,
  ): Promise<MessageResponseDto> {
    await this.passwordResetService.forgotPassword(dto.email);

    return this.message('auth.RESET_LINK_SENT');
  }

  @Post('reset-password')
  @Public()
  @HttpCode(HttpStatus.OK)
  @RateLimit(AUTH_RATE_LIMITS.resetPassword)
  @ApiOperation({
    summary: 'Set a new password',
    description:
      'Redeems the reset link. Every token issued before the reset stops ' +
      'working, and a pending account is activated.',
  })
  @ApiOkResponse({ type: MessageResponseDto })
  @ApiErrorResponse(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'The link is unknown, already used or expired.',
  )
  async resetPassword(
    @Body() dto: ResetPasswordDto,
  ): Promise<MessageResponseDto> {
    await this.passwordResetService.resetPassword(dto.token, dto.password);

    return this.message('auth.PASSWORD_RESET');
  }

  private message(key: string): MessageResponseDto {
    return { message: this.i18n.t(key) };
  }
}
