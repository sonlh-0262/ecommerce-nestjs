import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, JwtSignOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { AuthConfig, AUTH_CONFIG_KEY } from '../config/auth.config';
import { MailModule } from '../mail/mail.module';
import { UsersModule } from '../users/users.module';
import { AccountLinksService } from './account-links.service';
import { JWT_STRATEGY_NAME } from './auth.constants';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasswordResetService } from './password-reset.service';
import { RegistrationService } from './registration.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { TokenBlacklistService } from './token-blacklist.service';

@Module({
  imports: [
    UsersModule,
    MailModule,
    PassportModule.register({ defaultStrategy: JWT_STRATEGY_NAME }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const config = configService.getOrThrow<AuthConfig>(AUTH_CONFIG_KEY);

        return {
          secret: config.jwtSecret,
          signOptions: {
            expiresIn: config.jwtExpiresIn as JwtSignOptions['expiresIn'],
            issuer: config.jwtIssuer,
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    TokenBlacklistService,
    AccountLinksService,
    RegistrationService,
    PasswordResetService,
  ],
  exports: [AuthService],
})
export class AuthModule {}
