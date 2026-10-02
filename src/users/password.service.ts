import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';

import { AuthConfig, AUTH_CONFIG_KEY } from '../config/auth.config';

@Injectable()
export class PasswordService {
  private readonly saltRounds: number;

  constructor(configService: ConfigService) {
    this.saltRounds =
      configService.getOrThrow<AuthConfig>(AUTH_CONFIG_KEY).bcryptSaltRounds;
  }

  hash(plainText: string): Promise<string> {
    return bcrypt.hash(plainText, this.saltRounds);
  }

  compare(plainText: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plainText, hash);
  }
}
